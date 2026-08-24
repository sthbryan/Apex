import cn from "cnfast";
import { useCallback } from "preact/hooks";
import { dockPanelAt, popPanelToTab } from "@/app/layout/actions";
import { DOCK_PANELS } from "@/app/layout/panels";
import { type DockPanel, dockOrder, moveDockPanel, settleDockPanel } from "@/app/layout/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { useReorder } from "@/shared/ui/reorder";

export function DockOrder() {
  const order = dockOrder.value;
  const docked = new Set(order);
  const popped = (Object.keys(DOCK_PANELS) as DockPanel[]).filter((id) => !docked.has(id));

  const settle = useCallback((id: string, seat: number) => {
    settleDockPanel(id as DockPanel, seat);
  }, []);

  const { held, seat, hold, grab } = useReorder(settle);
  const from = held ? order.indexOf(held as DockPanel) : -1;

  const edge = (index: number): "top" | "bottom" | null => {
    if (seat === null || from < 0 || seat === from || index !== seat) {
      return null;
    }
    return seat < from ? "top" : "bottom";
  };

  const nudge = (id: DockPanel, event: KeyboardEvent) => {
    const step = STEPS[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    moveDockPanel(id, step);
  };

  return (
    <div class="flex w-64 flex-col gap-1">
      <ol ref={hold} class="flex flex-col gap-0.5">
        {order.map((id, index) => {
          const mark = edge(index);
          return (
            <li
              key={id}
              tabIndex={0}
              title={t("settings.sidebarDrag")}
              data-held={held === id || undefined}
              onMouseDown={(event) => {
                if ((event.target as HTMLElement).closest("button")) {
                  return;
                }
                grab(id, index, event);
              }}
              onKeyDown={(event) => nudge(id, event)}
              class={cn(
                "relative flex cursor-grab items-center gap-1 rounded px-1 py-0.5 outline-none focus-visible:bg-raised",
                held === id && "opacity-40",
              )}
            >
              {mark ? (
                <span
                  class={cn(
                    "absolute inset-x-0 h-0.5 bg-accent",
                    mark === "top" ? "-top-px" : "-bottom-px",
                  )}
                />
              ) : null}
              <Icon name={DOCK_PANELS[id].icon} class="text-faint" />
              <span class="min-w-0 flex-1 truncate text-text">{DOCK_PANELS[id].label()}</span>
              <button
                type="button"
                title={t("dock.popOut")}
                onClick={() => popPanelToTab(id)}
                class="flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
              >
                <Icon name="external" />
              </button>
            </li>
          );
        })}
      </ol>

      {popped.map((id) => (
        <div key={id} class="flex items-center gap-1 text-faint">
          <Icon name={DOCK_PANELS[id].icon} />
          <span class="min-w-0 flex-1 truncate">{DOCK_PANELS[id].label()}</span>
          <span class="text-xs">{t("settings.sidebarTab")}</span>
          <button
            type="button"
            title={t("dock.popIn")}
            onClick={() => dockPanelAt(id)}
            class="flex size-6 items-center justify-center rounded transition-colors hover:bg-raised hover:text-text"
          >
            <Icon name="panel" />
          </button>
        </div>
      ))}
    </div>
  );
}

const STEPS: Record<string, number> = {
  ArrowUp: -1,
  ArrowDown: 1,
};
