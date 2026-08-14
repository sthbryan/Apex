import cn from "cnfast";

import { dockPanelAt } from "@/app/layout/actions";
import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { activeTabId, closeTab, type Tab } from "@/features/workspace/state";
import { paneTitle } from "@/features/workspace/title";
import { leaves } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  tabs: Tab[];
  sessions: SessionSummary[];
};

export function TabBar({ tabs, sessions }: Props) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div class="flex h-8 min-h-8.5 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId.value;
        const panel = panelOf(tab);
        return (
          <div
            key={tab.id}
            class={cn(
              "group flex shrink-0 animate-row-in items-center gap-2 border-r border-border px-3 transition-colors",
              {
                "bg-bg text-text": active,
                "text-muted hover:text-text": !active,
              },
            )}
          >
            <button
              type="button"
              onClick={() => {
                activeTabId.value = tab.id;
              }}
              class="max-w-40 truncate"
            >
              {titleOf(tab, sessions)}
            </button>
            {panel && (
              <button
                type="button"
                title={t("dock.popIn")}
                onClick={() => dockPanelAt(panel)}
                class="text-faint opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-text"
              >
                <Icon name="panel" size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={() => closeTab(tab.id)}
              class="text-faint opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-text"
              aria-label="close"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function panelOf(tab: Tab): DockPanel | null {
  const panes = leaves(tab.root);
  if (panes.length === 1 && panes[0].view.type === "panel") {
    const id = panes[0].view.panel;
    return id in DOCK_PANELS ? (id as DockPanel) : null;
  }
  return null;
}

function titleOf(tab: Tab, sessions: SessionSummary[]): string {
  const titles = leaves(tab.root).map((pane) => paneTitle(pane.view, sessions));
  return titles.length > 1 ? `${titles[0]} +${titles.length - 1}` : (titles[0] ?? "");
}
