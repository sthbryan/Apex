import { useSignalEffect } from "@preact/signals";
import { useCallback, useEffect, useState } from "preact/hooks";

import { DaemonFailed } from "@/app/DaemonFailed";
import { useKeymap } from "@/app/keymap";
import { Layout } from "@/app/layout/Layout";
import { startDockWidth } from "@/app/layout/state";
import { loadEditors } from "@/features/files/editors";
import { FileFinder } from "@/features/files/FileFinder";
import { startGitWatch } from "@/features/git/state";
import { startNotifications } from "@/features/notifications/state";
import { Toasts } from "@/features/notifications/Toasts";
import { CommandPalette } from "@/features/palette/CommandPalette";
import { activeProject, history, loadProjects } from "@/features/projects/state";
import { CloseSession } from "@/features/sessions/CloseSession";
import { NewSession } from "@/features/sessions/NewSession";
import { focusTerminal } from "@/features/sessions/registry";
import { sessions } from "@/features/sessions/state";
import { applyIdleGrace } from "@/features/settings/agentMode";
import { applyAppearance } from "@/features/settings/appearance";
import { startPeeking } from "@/features/tasks/state";
import { startPaneCleanup } from "@/features/workspace/autoclose";
import { startViewIntents } from "@/features/workspace/intents";
import { activeSessionId } from "@/features/workspace/state";
import { agents, connect, platform, status } from "@/shared/daemon";
import { locale } from "@/shared/i18n";
import { startMetrics } from "@/shared/telemetry";
import { startThemeWatcher } from "@/shared/theme/mode";
import { watchFullscreen } from "@/shared/window";

export function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);

  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), []);
  const toggleFinder = useCallback(() => setFinderOpen((open) => !open), []);

  useEffect(() => {
    document.documentElement.lang = locale.value;
    void connect().then(loadProjects).then(loadEditors).then(applyIdleGrace);

    let stopNotifications: (() => void) | undefined;
    void startNotifications().then((stop) => {
      stopNotifications = stop;
    });

    let stopMetrics: (() => void) | undefined;
    void startMetrics().then((stop) => {
      stopMetrics = stop;
    });

    const stopGit = startGitWatch();
    const stopPeeking = startPeeking();
    const stopCleanup = startPaneCleanup();
    const stopIntents = startViewIntents();
    const stopTheme = startThemeWatcher();
    applyAppearance();
    const stopDockWidth = startDockWidth();
    return () => {
      stopNotifications?.();
      stopMetrics?.();
      stopGit();
      stopPeeking();
      stopCleanup();
      stopIntents();
      stopTheme();
      stopDockWidth();
    };
  }, []);

  useSignalEffect(() => {
    const platformName = platform.value;
    if (!platformName) {
      return;
    }
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void watchFullscreen(platformName).then((stop) => {
      if (cancelled) {
        stop();
      } else {
        dispose = stop;
      }
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  });

  useEffect(() => {
    if (paletteOpen) {
      return;
    }
    const session = activeSessionId.value;
    if (session) {
      focusTerminal(session);
    }
  }, [paletteOpen]);

  useKeymap({ togglePalette, toggleFinder });

  if (status.value === "failed") {
    return <DaemonFailed />;
  }

  return (
    <>
      <Layout onNewSession={() => setPaletteOpen(true)} />
      <Toasts />
      <NewSession />
      <CloseSession />
      <FileFinder open={finderOpen} onClose={() => setFinderOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        agents={agents.value}
        sessions={sessions.value}
        history={history.value}
        project={activeProject.value?.id ?? null}
        isGit={activeProject.value?.is_git ?? false}
      />
    </>
  );
}
