import { useSignalEffect } from "@preact/signals";
import { useCallback, useEffect, useState } from "preact/hooks";

import { useKeymap } from "@/app/keymap";
import { Dock, type DockPanel } from "@/app/layout/Dock";
import { StatusBar } from "@/app/layout/StatusBar";
import { TitleBar } from "@/app/layout/TitleBar";
import { Toolbar, ToolbarButton } from "@/app/layout/Toolbar";
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
import { focusTerminal } from "@/features/sessions/registry";
import { sessions } from "@/features/sessions/state";
import { Settings } from "@/features/settings/Settings";
import { toggleSettings } from "@/features/settings/state";
import { UsageChip } from "@/features/usage/UsageChip";
import { PaneTree } from "@/features/workspace/PaneTree";
import { activeSessionId, activeTabId, tabs } from "@/features/workspace/state";
import { TabBar } from "@/features/workspace/TabBar";
import { agents, connect, daemonVersion, failure, platform, status } from "@/shared/daemon";
import { locale, t } from "@/shared/i18n";
import { startMetrics } from "@/shared/telemetry";
import { startThemeWatcher } from "@/shared/theme/mode";
import { watchFullscreen } from "@/shared/window";

export function App() {
  const [dockOpen, setDockOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [panel, setPanel] = useState<DockPanel>("sessions");

  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), []);
  const toggleDock = useCallback(() => setDockOpen((open) => !open), []);

  useEffect(() => {
    document.documentElement.lang = locale.value;
    void connect().then(loadProjects);

    let stopNotifications: (() => void) | undefined;
    void startNotifications().then((stop) => {
      stopNotifications = stop;
    });

    let stopMetrics: (() => void) | undefined;
    void startMetrics().then((stop) => {
      stopMetrics = stop;
    });

    const stopTheme = startThemeWatcher();
    return () => {
      stopNotifications?.();
      stopMetrics?.();
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

  useKeymap({ togglePalette, toggleDock });

  if (status.value === "failed") {
    return (
      <div class="flex h-full flex-col bg-bg text-text">
        <TitleBar title={t("app.name")} />
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

  return (
    <div class="flex h-full flex-col bg-bg text-text">
      <TitleBar title={t("app.name")} lead={<ProjectPicker />}>
        <Toolbar
          status={
            status.value === "ready" ? `apexd ${daemonVersion.value ?? ""}` : t("status.connecting")
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

      <div class="flex min-h-0 flex-1">
        {dockOpen && (
          <Dock
            panel={panel}
            onPanel={setPanel}
            sessions={projectSessions.value}
            elsewhere={foreignSessions.value}
            projects={projects.value}
          />
        )}

        <div class="flex min-h-0 flex-1 flex-col">
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
        </div>
      </div>

      <StatusBar>
        <ResourcesSummary />
      </StatusBar>

      <Settings />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        agents={agents.value}
        sessions={sessions.value}
        history={history.value}
        project={activeProject.value?.id ?? null}
      />
    </div>
  );
}
