import { useSignalEffect } from "@preact/signals";
import { useCallback, useEffect, useState } from "preact/hooks";

import { useKeymap } from "@/app/keymap";
import { Layout } from "@/app/layout/Layout";
import { startDockWidth } from "@/app/layout/state";
import { TitleBar } from "@/app/layout/TitleBar";
import { loadEditors } from "@/features/files/editors";
import { FileFinder } from "@/features/files/FileFinder";
import { startGitWatch } from "@/features/git/state";
import { startNotifications } from "@/features/notifications/state";
import { CommandPalette } from "@/features/palette/CommandPalette";
import { activeProject, history, loadProjects } from "@/features/projects/state";
import { CloseSession } from "@/features/sessions/CloseSession";
import { NewSession } from "@/features/sessions/NewSession";
import { focusTerminal } from "@/features/sessions/registry";
import { sessions } from "@/features/sessions/state";
import { startPeeking } from "@/features/tasks/state";
import { startPaneCleanup } from "@/features/workspace/autoclose";
import { activeSessionId } from "@/features/workspace/state";
import { agents, connect, failure, platform, stale, status } from "@/shared/daemon";
import { locale, t } from "@/shared/i18n";
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
    void connect().then(loadProjects).then(loadEditors);

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
    const stopTheme = startThemeWatcher();
    const stopDockWidth = startDockWidth();
    return () => {
      stopNotifications?.();
      stopMetrics?.();
      stopGit();
      stopPeeking();
      stopCleanup();
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

function DaemonFailed() {
  return (
    <div class="flex h-full flex-col bg-bg text-text">
      <TitleBar reserveControls />
      <main class="flex-1 overflow-auto p-4">
        <p class="text-state-blocked">
          {stale.value ? t("daemon.stale") : t("daemon.unreachable")}
        </p>
        {stale.value && <p class="mt-1 text-muted">{t("daemon.staleHint")}</p>}
        <pre class="mt-2 max-w-xl overflow-x-auto rounded border border-border bg-surface p-3 text-muted">
          {failure.value}
        </pre>
        <button
          type="button"
          class="mt-3 rounded border border-border px-3 py-1 hover:bg-raised"
          onClick={() => void connect()}
        >
          {t("daemon.retry")}
        </button>
      </main>
    </div>
  );
}
