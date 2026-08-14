import { Icon } from "../components/Icon";
import type { SessionSummary } from "../bindings/SessionSummary";
import { leaves } from "./tree";
import { type Tab, activeTabId, closeTab } from "./workspace";
import cn from "cnfast";

type Props = {
  tabs: Tab[];
  sessions: SessionSummary[];
};

export function TabBar({ tabs, sessions }: Props) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div class="flex h-8 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId.value;
        return (
          <div
            key={tab.id}
            class={cn("group flex shrink-0 animate-row-in items-center gap-2 border-r border-border px-3 transition-colors", {
              "bg-bg text-text": active,
              "text-muted hover:text-text": !active,
            })}
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

function titleOf(tab: Tab, sessions: SessionSummary[]): string {
  const titles = leaves(tab.root).map(
    (pane) =>
      sessions.find((session) => session.id === pane.sessionId)?.title ?? pane.sessionId.slice(0, 8),
  );
  return titles.length > 1 ? `${titles[0]} +${titles.length - 1}` : (titles[0] ?? "");
}
