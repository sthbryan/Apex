import { useSignalEffect } from "@preact/signals";
import { useCallback, useEffect, useState } from "preact/hooks";

import { useKeymap } from "@/app/keymap";
import { Dock, type DockPanel } from "@/app/layout/Dock";
import { DockSlot } from "@/app/layout/DockSlot";
import { StatusBar } from "@/app/layout/StatusBar";
import { TitleBar } from "@/app/layout/TitleBar";
import { Toolbar, ToolbarButton } from "@/app/layout/Toolbar";
import { loadEditors } from "@/features/files/editors";
import { FileFinder } from "@/features/files/FileFinder";
import { startNotifications } from "@/features/notifications/state";
import { CommandPalette } from "@/features/palette/CommandPalette";
import { ProjectPicker } from "@/features/projects/ProjectPicker";
import {
  activeProject,
  foreignSessions,
  history,
  loadProjects,
  projectSessions,
  projects,
} from "@/features/projects/state";
import { ResourcesSummary } from "@/features/resources/ResourcesSummary";
import { CloseSession } from "@/features/sessions/CloseSession";
import { NewSession } from "@/features/sessions/NewSession";
import { focusTerminal } from "@/features/sessions/registry";
import { sessions } from "@/features/sessions/state";
import { Settings } from "@/features/settings/Settings";
import { dockOpen, toggleDock, toggleSettings } from "@/features/settings/state";
import { UsageChip } from "@/features/usage/UsageChip";
import { startPaneCleanup } from "@/features/workspace/autoclose";
import { PaneTree } from "@/features/workspace/PaneTree";
import { activeSessionId, activeTabId, tabs } from "@/features/workspace/state";
import { TabBar } from "@/features/workspace/TabBar";
import { agents, connect, daemonVersion, failure, platform, status } from "@/shared/daemon";
import { locale, t } from "@/shared/i18n";
import { startMetrics } from "@/shared/telemetry";
import { startThemeWatcher } from "@/shared/theme/mode";
import { watchFullscreen } from "@/shared/window";

export function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [panel, setPanel] = useState<DockPanel>("sessions");
  const [dockMounted, setDockMounted] = useState(dockOpen.value);

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

    const stopCleanup = startPaneCleanup();
    const stopTheme = startThemeWatcher();
    return () => {
      stopNotifications?.();
      stopMetrics?.();
      stopCleanup();
      stopTheme();
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
    return (
      <div class="flex h-full flex-col bg-bg text-text">
        <TitleBar reserveControls />
        <main class="flex-1 overflow-auto p-4">
          <p class="text-state-blocked">{t("daemon.unreachable")}</p>
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

  const sidebarToggle = (
    <ToolbarButton
      label={t("dock.toggle")}
      icon="panel"
      pressed={dockOpen.value}
      onClick={toggleDock}
    />
  );

  return (
    <div class="flex h-full bg-bg text-text">
      <DockSlot open={dockOpen.value} onMountedChange={setDockMounted}>
        <Dock
          header={
            <>
              <span data-tauri-drag-region class="truncate font-semibold tracking-wide">
                {t("app.name")}
              </span>
              <span class="ml-auto pr-2">{sidebarToggle}</span>
            </>
          }
          panel={panel}
          onPanel={setPanel}
          sessions={projectSessions.value}
          elsewhere={foreignSessions.value}
          projects={projects.value}
        />
      </DockSlot>

      <div class="flex min-w-0 flex-1 flex-col">
        <TitleBar
          reserveControls={!dockMounted}
          lead={
            <>
              {!dockMounted && (
                <div class="flex animate-veil-in items-center gap-3">
                  {sidebarToggle}
                  <span class="shrink-0 font-semibold tracking-wide">{t("app.name")}</span>
                </div>
              )}
              <ProjectPicker />
            </>
          }
        >
          <Toolbar
            status={
              status.value === "ready"
                ? `apexd ${daemonVersion.value ?? ""}`
                : t("status.connecting")
            }
          >
            <UsageChip />
            <ToolbarButton
              label={t("toolbar.newSession")}
              icon="plus"
              onClick={() => setPaletteOpen(true)}
            />
            <ToolbarButton label={t("settings.title")} icon="settings" onClick={toggleSettings} />
          </Toolbar>
        </TitleBar>

        <TabBar tabs={tabs.value} sessions={sessions.value} />

        <div class="relative min-h-0 flex-1">
          {tabs.value.length === 0 ? (
            <div class="flex h-full flex-col items-center justify-center gap-1 text-faint">
              <p>{activeProject.value ? t("workspace.empty") : t("projects.empty")}</p>
              {activeProject.value && <p>{t("workspace.emptyHint", { shortcut: "⌘K" })}</p>}
            </div>
          ) : (
            tabs.value.map((tab) => {
              const active = tab.id === activeTabId.value;
              return (
                <div
                  key={tab.id}
                  class="absolute inset-0"
                  style={{ visibility: active ? "visible" : "hidden", zIndex: active ? 1 : 0 }}
                >
                  <PaneTree
                    tabId={tab.id}
                    node={tab.root}
                    activeLeafId={tab.activeLeafId}
                    tabActive={active}
                  />
                </div>
              );
            })
          )}
        </div>

        <StatusBar>
          <ResourcesSummary />
        </StatusBar>
      </div>

      <NewSession />

      <CloseSession />

      <Settings />

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
    </div>
  );
}
