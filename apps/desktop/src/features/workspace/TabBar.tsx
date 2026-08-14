import cn from "cnfast";

import { dockPanelAt, popPanelToTab } from "@/app/layout/actions";
import { hasPanelDrag, readPanelDrag } from "@/app/layout/dnd";
import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import type { SessionSummary } from "@/bindings/SessionSummary";
import {
  hasPaneDrag,
  hasTabDrag,
  readPaneDrag,
  readTabDrag,
  writeTabDrag,
} from "@/features/workspace/dnd";
import {
  activeTabId,
  closeTab,
  extractLeafToTab,
  moveTab,
  type Tab,
} from "@/features/workspace/state";
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

  const onDrop = (before: string | undefined, event: DragEvent) => {
    const pane = readPaneDrag(event);
    if (pane) {
      event.preventDefault();
      extractLeafToTab(pane.tabId, pane.leafId);
      return;
    }
    const tabId = readTabDrag(event);
    if (tabId) {
      event.preventDefault();
      moveTab(tabId, before);
      return;
    }
    const panel = readPanelDrag(event);
    if (panel) {
      event.preventDefault();
      popPanelToTab(panel);
    }
  };

  return (
    <div
      class="flex h-8 min-h-8.5 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface"
      onDragOver={(event) => {
        if (hasPaneDrag(event) || hasTabDrag(event) || hasPanelDrag(event)) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => onDrop(undefined, event)}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId.value;
        const panel = panelOf(tab);
        return (
          <div
            key={tab.id}
            draggable
            onDragStart={(event) => writeTabDrag(event, tab.id)}
            onDragOver={(event) => {
              if (hasPaneDrag(event) || hasTabDrag(event) || hasPanelDrag(event)) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onDrop={(event) => {
              event.stopPropagation();
              onDrop(tab.id, event);
            }}
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
