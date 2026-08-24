import { useSignalEffect } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { DaemonFailed } from "@/app/DaemonFailed";
import { useKeymap } from "@/app/keymap";
import { Layout } from "@/app/layout/Layout";
import { startDockWidth } from "@/app/layout/state";
import { startMenu } from "@/app/menu";
import { startBlockedUrls } from "@/features/browser/state";
import { loadEditors } from "@/features/files/editors";
import { FileFinder } from "@/features/files/FileFinder";
import { startGitWatch } from "@/features/git/state";
import { startNotifications, warnBlockedAgents } from "@/features/notifications/state";
import { Toasts } from "@/features/notifications/Toasts";
import { CommandPalette } from "@/features/palette/CommandPalette";
import { finderOpen, paletteOpen, toggleFinder, togglePalette } from "@/features/palette/state";
import { activeProject, history, loadProjects, startLayoutSaves } from "@/features/projects/state";
import { CloseSession } from "@/features/sessions/CloseSession";
import { NewSession } from "@/features/sessions/NewSession";
import { focusTerminal } from "@/features/sessions/registry";
import { sessions } from "@/features/sessions/state";
import { adoptAgents, applyIdleGrace, enabledAgents } from "@/features/settings/agentMode";
import { applyAppearance } from "@/features/settings/appearance";
import { applyClosing } from "@/features/settings/closing";
import { Settings } from "@/features/settings/Settings";
import { loadToolGroups } from "@/features/settings/toolGroups";
import { startPeeking } from "@/features/tasks/state";
import { watchForUpdates } from "@/features/updates/state";
import { startPaneCleanup } from "@/features/workspace/autoclose";
import { startViewIntents } from "@/features/workspace/intents";
import { activeSessionId, startTargetFollow } from "@/features/workspace/state";
import { connect, platform, status } from "@/shared/daemon";
import { locale } from "@/shared/i18n";
import { startMetrics } from "@/shared/telemetry";
import { startThemeWatcher } from "@/shared/theme/mode";
import { ContextMenu } from "@/shared/ui/ContextMenu";
import { watchFullscreen } from "@/shared/window";

export function App() {
  useEffect(() => {
    document.documentElement.lang = locale.value;
    void connect()
      .then(loadProjects)
      .then(loadEditors)
      .then(applyIdleGrace)
      .then(adoptAgents)
      .then(loadToolGroups)
      .then(warnBlockedAgents);

    void watchForUpdates();

    let stopNotifications: (() => void) | undefined;
    void startNotifications().then((stop) => {
      stopNotifications = stop;
    });

    let stopMenu: (() => void) | undefined;
    void startMenu().then((stop) => {
      stopMenu = stop;
    });

    let stopMetrics: (() => void) | undefined;
    void startMetrics().then((stop) => {
      stopMetrics = stop;
    });

    const stopGit = startGitWatch();
    const stopPeeking = startPeeking();
    const stopCleanup = startPaneCleanup();
    const stopIntents = startViewIntents();
    const stopBlocked = startBlockedUrls();
    const stopTheme = startThemeWatcher();
    applyAppearance();
    applyClosing();
    const stopDockWidth = startDockWidth();
    const stopLayoutSaves = startLayoutSaves();
    const stopTargetFollow = startTargetFollow();
    return () => {
      stopNotifications?.();
      stopMenu?.();
      stopMetrics?.();
      stopGit();
      stopPeeking();
      stopCleanup();
      stopIntents();
      stopBlocked();
      stopTheme();
      stopDockWidth();
      stopLayoutSaves();
      stopTargetFollow();
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

  useSignalEffect(() => {
    if (paletteOpen.value) {
      return;
    }
    const session = activeSessionId.value;
    if (session) {
      focusTerminal(session);
    }
  });

  useKeymap({ togglePalette, toggleFinder });

  if (status.value === "failed") {
    return <DaemonFailed />;
  }

  return (
    <>
      <Layout onNewSession={togglePalette} />
      <ContextMenu />
      <Toasts />
      <Settings />
      <NewSession />
      <CloseSession />
      <FileFinder
        open={finderOpen.value}
        onClose={() => {
          finderOpen.value = false;
        }}
      />
      <CommandPalette
        open={paletteOpen.value}
        onClose={() => {
          paletteOpen.value = false;
        }}
        agents={enabledAgents.value}
        sessions={sessions.value}
        history={history.value}
        project={activeProject.value?.id ?? null}
        isGit={activeProject.value?.is_git ?? false}
      />
    </>
  );
}
