import cn from "cnfast";
import type { VNode } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import { dockPanelAt } from "@/app/layout/actions";
import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { activeTabId, closeTab, mergeTabInto, type Tab } from "@/features/workspace/state";
import { paneIcon, paneTitle } from "@/features/workspace/title";
import { leaves } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";

const OVERFLOW_W = 52;

type Props = {
  tabs: Tab[];
  sessions: SessionSummary[];
};

export function TabBar({ tabs, sessions }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const tabEls = useRef<(HTMLDivElement | null)[]>([]);
  const [hidden, setHidden] = useState(0);
  const [open, setOpen] = useState(false);
  const popover = usePresence<HTMLDivElement>(open);

  useLayoutEffect(() => {
    const node = holder.current;
    if (!node) {
      return;
    }
    const measure = () => {
      const available = node.clientWidth - OVERFLOW_W;
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

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", dismiss);
    return () => window.removeEventListener("mousedown", dismiss);
  }, [open]);

  if (tabs.length === 0) {
    return null;
  }

  const overflowTabs = hidden > 0 ? tabs.slice(tabs.length - hidden) : [];

  return (
    <div
      ref={holder}
      class="relative flex h-8 min-h-8.5 shrink-0 items-stretch border-b border-border"
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
          <div
            key={tab.id}
            ref={(el) => {
              tabEls.current[index] = el;
            }}
            class={cn(
              "group relative flex shrink-0 animate-row-in items-center gap-2 border-r border-border px-3 transition-colors hover:bg-surface hover:text-text",
              overflowed && "invisible pointer-events-none absolute",
              active ? "bg-surface text-text" : "text-muted hover:text-text",
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                class="pointer-events-none absolute inset-x-2 top-0 h-0.5 rounded-full bg-accent"
              />
            )}
            <span class="flex shrink-0 items-center gap-0.5">{identities(tab, sessions)}</span>
            <button
              type="button"
              onClick={() => {
                activeTabId.value = tab.id;
              }}
              class="max-w-36 truncate"
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
          </div>
        );
      })}

      {hidden > 0 && (
        <div class="relative flex shrink-0 items-stretch">
          <button
            type="button"
            title={t("workspace.moreTabs", { count: String(hidden) })}
            onClick={() => setOpen((value) => !value)}
            class={cn(
              "flex items-center gap-0.5 border-r border-border px-2.5 text-muted transition-colors hover:text-text",
              open && "bg-bg text-text",
            )}
          >
            <Icon name="plus" size={12} />
            {hidden}
          </button>
          {popover.mounted && (
            <div
              ref={popover.holder}
              class={cn("absolute right-0 top-full z-50 mt-1 origin-top-right", {
                "animate-drop-out": popover.leaving,
                "animate-drop-in": !popover.leaving,
              })}
            >
              <div class="w-56 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-2xl">
                {overflowTabs.map((tab) => {
                  const active = tab.id === activeTabId.value;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        activeTabId.value = tab.id;
                        setOpen(false);
                      }}
                      class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-raised"
                    >
                      <span class="flex shrink-0 items-center gap-0.5 text-faint">
                        {identities(tab, sessions)}
                      </span>
                      <span class="truncate text-[12px] text-text">{titleOf(tab, sessions)}</span>
                      {active && (
                        <Icon name="check" size={12} class="ml-auto shrink-0 text-faint" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function identities(tab: Tab, sessions: SessionSummary[]): VNode[] {
  return leaves(tab.root)
    .slice(0, 3)
    .map((node) => {
      if (node.view.type === "session") {
        const sessionId = node.view.sessionId;
        const session = sessions.find((candidate) => candidate.id === sessionId);
        return <AgentIcon key={node.id} agent={session?.agent ?? ""} size={12} />;
      }
      return <Icon key={node.id} name={paneIcon(node.view)} size={12} />;
    });
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
  return paneTitle(leaves(tab.root)[0].view, sessions);
}
