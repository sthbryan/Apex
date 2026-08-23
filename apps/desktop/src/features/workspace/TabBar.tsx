import { Tab as KitTab, TabBar as KitTabBar, Popover } from "@apex/ui";
import cn from "cnfast";
import type { VNode } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { dockPanelAt } from "@/app/layout/actions";
import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { togglePalette } from "@/features/palette/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { activeTabId, closeTab, mergeTabInto, type Tab } from "@/features/workspace/state";
import { paneIcon, paneTitle } from "@/features/workspace/title";
import { type Leaf, leaves } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const OVERFLOW_W = 52;
const ADD_W = 38;

type Props = {
  tabs: Tab[];
  sessions: SessionSummary[];
};

export function TabBar({ tabs, sessions }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const tabEls = useRef<(HTMLDivElement | null)[]>([]);
  const [hidden, setHidden] = useState(0);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const node = holder.current;
    if (!node) {
      return;
    }
    const measure = () => {
      const available = node.clientWidth - OVERFLOW_W - ADD_W;
      const widths = tabEls.current.map((el) => el?.offsetWidth ?? 0);
      let used = 0;
      let shown = 0;
      for (const width of widths) {
        if (used + width > available) {
          break;
        }
        used += width;
        shown += 1;
      }
      setHidden(Math.max(0, widths.length - shown));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [tabs]);

  const overflowTabs = hidden > 0 ? tabs.slice(tabs.length - hidden) : [];

  return (
    <KitTabBar
      data-tauri-drag-region
      elRef={holder}
      label={t("workspace.tabs")}
      class="relative"
      addLabel={t("toolbar.newSession")}
      addIcon={<Icon name="plus" size={14} />}
      onAdd={togglePalette}
    >
      {tabs.map((tab, index) => {
        const active = tab.id === activeTabId.value;
        const overflowed = index >= tabs.length - hidden;
        const panel = panelOf(tab);
        const mergeTarget = (() => {
          if (tab.id !== activeTabId.value) {
            return activeTabId.value;
          }
          const i = tabs.findIndex((candidate) => candidate.id === tab.id);
          return tabs[i + 1]?.id ?? tabs[i - 1]?.id ?? null;
        })();
        return (
          <KitTab
            key={tab.id}
            elRef={(el: HTMLDivElement | null) => {
              tabEls.current[index] = el;
            }}
            title={titleOf(tab, sessions)}
            selected={active}
            class={cn(
              "group animate-row-in",
              overflowed && "invisible pointer-events-none absolute",
            )}
            lead={identity(tab, sessions)}
            onOpen={() => {
              activeTabId.value = tab.id;
            }}
            trail={
              <>
                {leaves(tab.root).length > 1 && (
                  <span class="shrink-0 text-xs text-faint tabular-nums">
                    +{leaves(tab.root).length - 1}
                  </span>
                )}
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
                {mergeTarget && tabs.length > 1 && (
                  <button
                    type="button"
                    title={t("workspace.mergeTab")}
                    onClick={() => mergeTabInto(tab.id, mergeTarget)}
                    class="text-faint opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-text"
                  >
                    <Icon name="combine" size={12} />
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
              </>
            }
          />
        );
      })}

      {hidden > 0 && (
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          side="bottom"
          align="end"
          width={224}
          label={t("workspace.moreTabs", { count: String(hidden) })}
          anchor={
            <button
              type="button"
              title={t("workspace.moreTabs", { count: String(hidden) })}
              onClick={() => setOpen((value) => !value)}
              class={cn(
                "flex h-full items-center gap-0.5 border-r border-border px-2.5 text-muted transition-colors hover:text-text",
                open && "bg-bg text-text",
              )}
            >
              <Icon name="plus" size={12} />
              {hidden}
            </button>
          }
        >
          {overflowTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                activeTabId.value = tab.id;
                setOpen(false);
              }}
              class="flex w-full items-center gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-raised"
            >
              <span class="flex shrink-0 items-center text-faint">{identity(tab, sessions)}</span>
              <span class="truncate text-sm text-text">{titleOf(tab, sessions)}</span>
              {tab.id === activeTabId.value && (
                <Icon name="check" size={12} class="ml-auto shrink-0 text-faint" />
              )}
            </button>
          ))}
        </Popover>
      )}
    </KitTabBar>
  );
}

function identity(tab: Tab, sessions: SessionSummary[]): VNode {
  const view = frontPane(tab).view;
  if (view.type === "session") {
    const session = sessions.find((candidate) => candidate.id === view.sessionId);
    return <AgentIcon agent={session?.agent ?? ""} />;
  }
  return <Icon name={paneIcon(view)} size={12} />;
}

function frontPane(tab: Tab): Leaf {
  const panes = leaves(tab.root);
  return panes.find((pane) => pane.id === tab.activeLeafId) ?? panes[0];
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
  return paneTitle(frontPane(tab).view, sessions);
}
