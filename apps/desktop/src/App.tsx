import { useEffect, useState } from "preact/hooks";

import { agents, connect, daemonVersion, failure, platform, status } from "./daemon";
import {
  activeProject,
  foreignSessions,
  history,
  loadProjects,
  projectSessions,
} from "./projects";
import { locale, t } from "./i18n";
import { SessionsPanel } from "./panels/SessionsPanel";
import { sessions } from "./sessions";
import { projects } from "./projects";
import { CommandPalette } from "./shell/CommandPalette";
import { PaneTree } from "./shell/PaneTree";
import { TabBar } from "./shell/TabBar";
import { ProjectPicker } from "./shell/ProjectPicker";
import { TitleBar } from "./shell/TitleBar";
import { Toolbar } from "./shell/Toolbar";
import { findLeaf } from "./shell/tree";
import { startNotifications } from "./notifications";
import { startThemeWatcher } from "./theme/mode";
import { watchFullscreen } from "./shell/windowControls";
import {
  activeSessionId,
  activeTab,
  activeTabId,
  closePane,
  splitWithNewSession,
  tabs,
} from "./shell/workspace";
import { focusTerminal } from "./views/terminalRegistry";

export function App() {
  const [dockOpen, setDockOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale.value;
    void connect().then(loadProjects);

    let stopNotifications: (() => void) | undefined;
    void startNotifications().then((stop) => {
      stopNotifications = stop;
    });

    const stopTheme = startThemeWatcher();
    return () => {
      stopNotifications?.();
      stopTheme();
    };
  }, []);

  useEffect(() => {
    if (!platform.value) {
      return;
    }
    let dispose: (() => void) | undefined;
    void watchFullscreen(platform.value).then((stop) => {
      dispose = stop;
    });
    return () => dispose?.();
  }, [platform.value]);

  useEffect(() => {
    if (paletteOpen) {
      return;
    }
    const session = activeSessionId.value;
    if (session) {
      focusTerminal(session);
    }
  }, [paletteOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      const key = event.key.toLowerCase();

      if (key === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (key === "b") {
        event.preventDefault();
        setDockOpen((open) => !open);
        return;
      }
      if (key === "d") {
        event.preventDefault();
        const tab = activeTab.value;
        const pane = tab ? findLeaf(tab.root, tab.activeLeafId) : null;
        const session = sessions.value.find((candidate) => candidate.id === pane?.sessionId);
        if (session) {
          void splitWithNewSession(
            session.project_id,
            session.agent,
            event.shiftKey ? "column" : "row",
          );
        }
        return;
      }
      if (key === "w") {
        event.preventDefault();
        const tab = activeTab.value;
        const pane = tab ? findLeaf(tab.root, tab.activeLeafId) : null;
        if (tab && pane) {
          closePane(tab.id, pane, true);
        }
        return;
      }

      const index = Number.parseInt(event.key, 10);
      if (Number.isInteger(index) && index >= 1 && index <= 9) {
        const target = tabs.value[index - 1];
        if (target) {
          event.preventDefault();
          activeTabId.value = target.id;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

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
          onNewSession={() => setPaletteOpen(true)}
          status={
            status.value === "ready" ? `apexd ${daemonVersion.value ?? ""}` : t("status.connecting")
          }
        />
      </TitleBar>

      <div class="flex min-h-0 flex-1">
        {dockOpen && (
          <aside class="w-56 shrink-0 border-r border-border bg-surface">
            <SessionsPanel
              sessions={projectSessions.value}
              elsewhere={foreignSessions.value}
              projects={projects.value}
            />
          </aside>
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
