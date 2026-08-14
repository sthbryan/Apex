import cn from "cnfast";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { activeTabId, closeTab, type Tab } from "@/features/workspace/state";
import { leaves } from "@/features/workspace/tree";
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
    <div class="flex h-8 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId.value;
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
  const titles = leaves(tab.root).map((pane) => {
    if (pane.view.type === "file") {
      return pane.view.path.split("/").at(-1) ?? pane.view.path;
    }
    if (pane.view.type === "diff") {
      return `± ${pane.view.path.split("/").at(-1) ?? pane.view.path}`;
    }
    const { sessionId } = pane.view;
    return sessions.find((session) => session.id === sessionId)?.title ?? sessionId.slice(0, 8);
  });
  return titles.length > 1 ? `${titles[0]} +${titles.length - 1}` : (titles[0] ?? "");
}
