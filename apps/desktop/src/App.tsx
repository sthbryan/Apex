import { useEffect, useState } from "preact/hooks";

import { agents, connect, daemonVersion, failure, platform, status } from "./daemon";
import { locale, setLocale, t } from "./i18n";
import { SessionsPanel } from "./panels/SessionsPanel";
import { sessions } from "./sessions";
import { CommandPalette } from "./shell/CommandPalette";
import { PaneTree } from "./shell/PaneTree";
import { TabBar } from "./shell/TabBar";
import { TitleBar } from "./shell/TitleBar";
import { findLeaf } from "./shell/tree";
import { watchFullscreen } from "./shell/windowControls";
import { activeTab, activeTabId, closePane, splitWithNewSession, tabs } from "./shell/workspace";

export function App() {
  const [dockOpen, setDockOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale.value;
    void connect();
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
          void splitWithNewSession(session.agent, event.shiftKey ? "column" : "row");
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
      <TitleBar title={t("app.name")}>
        <span class="text-faint">
          {status.value === "ready" ? `apexd ${daemonVersion.value ?? ""}` : t("status.connecting")}
        </span>
        <button
          type="button"
          class="rounded border border-border px-1.5 uppercase text-faint hover:text-text"
          onClick={() => setLocale(locale.value === "es" ? "en" : "es")}
        >
          {locale.value}
        </button>
      </TitleBar>

      <div class="flex min-h-0 flex-1">
        {dockOpen && (
          <aside class="w-56 shrink-0 border-r border-border bg-surface">
            <SessionsPanel sessions={sessions.value} agents={agents.value} />
          </aside>
        )}

        <div class="flex min-h-0 flex-1 flex-col">
          <TabBar tabs={tabs.value} sessions={sessions.value} />
          <div class="relative min-h-0 flex-1">
            {tabs.value.length === 0 ? (
              <div class="flex h-full flex-col items-center justify-center gap-1 text-faint">
                <p>{t("workspace.empty")}</p>
                <p>{t("workspace.emptyHint", { shortcut: "⌘K" })}</p>
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
      />
    </div>
  );
}
