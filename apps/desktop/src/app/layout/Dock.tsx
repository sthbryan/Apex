import cn from "cnfast";
import type { ComponentChildren } from "preact";

import { dockPanelAt, popPanelToTab } from "@/app/layout/actions";
import { DockResize } from "@/app/layout/DockResize";
import { allowPanelDrop, clearPanelDrag, readPanelDrag, writePanelDrag } from "@/app/layout/dnd";
import { DOCK_PANELS } from "@/app/layout/panels";
import { dockOrder, dockPanel, setDockPanel } from "@/app/layout/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  header?: ComponentChildren;
  floating?: boolean;
};

export function Dock({ header, floating = false }: Props) {
  const order = dockOrder.value;
  const active = order.includes(dockPanel.value) ? dockPanel.value : order[0];
  const View = active ? DOCK_PANELS[active].View : null;

  const dropOn = (before: typeof active | undefined, event: DragEvent) => {
    event.preventDefault();
    const id = readPanelDrag();
    if (!id || id === before) {
      return;
    }
    dockPanelAt(id, before);
  };

  return (
    <aside
      class={cn(
        "relative flex h-full w-full flex-col overflow-hidden border-r border-border transition-[border-radius,box-shadow,background-color] duration-(--apex-dock)",
        floating
          ? "rounded-r-xl bg-bg shadow-[8px_0_28px_rgba(0,0,0,0.28)]"
          : "rounded-none bg-surface shadow-none",
      )}
      onDragOver={allowPanelDrop}
      onDrop={(event) => dropOn(undefined, event)}
    >
      <div
        data-tauri-drag-region
        class="flex h-9 shrink-0 select-none items-center"
        style={{ paddingLeft: "max(var(--apex-controls-start, 0px), 0.75rem)" }}
      >
        {header}
      </div>

      {order.length > 0 && (
        <nav class="flex min-h-8.5 shrink-0 gap-1 border-b border-border px-1 py-1">
          {order.map((id) => {
            const entry = DOCK_PANELS[id];
            return (
              <div
                key={id}
                onDragOver={(event) => {
                  if (allowPanelDrop(event)) {
                    event.stopPropagation();
                  }
                }}
                onDrop={(event) => {
                  event.stopPropagation();
                  dropOn(id, event);
                }}
              >
                <button
                  type="button"
                  title={entry.label()}
                  draggable
                  onDragStart={(event) => writePanelDrag(event, id)}
                  onDragEnd={() => clearPanelDrag()}
                  onClick={() => setDockPanel(id)}
                  onDblClick={() => popPanelToTab(id)}
                  class={cn(
                    "flex size-6 items-center justify-center rounded transition-colors",
                    active === id
                      ? "bg-raised text-text"
                      : floating
                        ? "text-muted hover:text-text"
                        : "text-faint hover:text-text",
                  )}
                >
                  <Icon name={entry.icon} />
                </button>
              </div>
            );
          })}
        </nav>
      )}

      <DockResize />

      <div class="min-h-0 flex-1 overflow-hidden">
        {View && active ? (
          <div key={active} class="h-full animate-dock-view">
            <View />
          </div>
        ) : (
          <p class="p-3 text-faint">{t("dock.empty")}</p>
        )}
      </div>
    </aside>
  );
}
