import cn from "cnfast";
import { useCallback } from "preact/hooks";
import { dockPanelAt, popPanelToTab } from "@/app/layout/actions";
import { DOCK_PANELS } from "@/app/layout/panels";
import { type DockPanel, dockOrder, settleDockPanel } from "@/app/layout/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { useReorder } from "@/shared/ui/reorder";

const LINE = "__line__";

function rowsNow(): string[] {
  const order = dockOrder.value;
  const popped = (Object.keys(DOCK_PANELS) as DockPanel[]).filter((id) => !order.includes(id));
  return [...order, LINE, ...popped];
}

function place(id: DockPanel, seat: number): void {
  const order = dockOrder.value;
  const next = rowsNow().filter((row) => row !== id);
  next.splice(seat, 0, id);

  const line = next.indexOf(LINE);
  const at = next.indexOf(id);
  const wasDocked = order.includes(id);

  if (at > line) {
    if (wasDocked) {
      popPanelToTab(id);
    }
    return;
  }
  if (wasDocked) {
    settleDockPanel(id, at);
    return;
  }
  const before = next[at + 1];
  dockPanelAt(id, before === LINE ? undefined : (before as DockPanel));
}

export function DockOrder() {
  const rows = rowsNow();

  const settle = useCallback((id: string, seat: number) => {
    place(id as DockPanel, seat);
  }, []);

  const { held, seat, hold, grab } = useReorder(settle);
  const from = held ? rows.indexOf(held) : -1;

  const edge = (index: number): "top" | "bottom" | null => {
    if (seat === null || from < 0 || seat === from || index !== seat) {
      return null;
    }
    return seat < from ? "top" : "bottom";
  };

  const nudge = (id: string, index: number, event: KeyboardEvent) => {
    const step = STEPS[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const seat = Math.min(Math.max(index + step, 0), rows.length - 1);
    place(id as DockPanel, seat);
  };

  return (
    <ol ref={hold} class="flex w-64 flex-col gap-0.5">
      {rows.map((row, index) => {
        const mark = edge(index);
        const marker = mark ? (
          <span
            class={cn(
              "absolute inset-x-0 h-0.5 bg-accent",
              mark === "top" ? "-top-px" : "-bottom-px",
            )}
          />
        ) : null;

        if (row === LINE) {
          return (
            <li key={row} class="relative flex items-center gap-2 py-1.5 text-faint text-xs">
              {marker}
              <span class="h-px flex-1 bg-border" />
              {t("settings.sidebarTab")}
              <span class="h-px flex-1 bg-border" />
            </li>
          );
        }

        const id = row as DockPanel;
        const tabbed = index > rows.indexOf(LINE);
        return (
          <li
            key={row}
            tabIndex={0}
            title={t("settings.sidebarDrag")}
            data-held={held === row || undefined}
            onMouseDown={(event) => grab(row, index, event)}
            onKeyDown={(event) => nudge(row, index, event)}
            class={cn(
              "relative flex cursor-grab items-center gap-1.5 rounded px-1 py-0.5 outline-none focus-visible:bg-raised",
              tabbed ? "text-faint" : "text-text",
              held === row && "opacity-40",
            )}
          >
            {marker}
            <Icon name={DOCK_PANELS[id].icon} class={tabbed ? undefined : "text-faint"} />
            <span class="min-w-0 flex-1 truncate">{DOCK_PANELS[id].label()}</span>
          </li>
        );
      })}
    </ol>
  );
}

const STEPS: Record<string, number> = {
  ArrowUp: -1,
  ArrowDown: 1,
};
