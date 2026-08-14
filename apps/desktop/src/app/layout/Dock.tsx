import cn from "cnfast";
import type { ComponentChildren } from "preact";

import { DockResize } from "@/app/layout/DockResize";
import { DOCK_PANEL_ORDER, DOCK_PANELS } from "@/app/layout/panels";
import { dockPanel, setDockPanel } from "@/app/layout/state";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  header?: ComponentChildren;
  floating?: boolean;
};

export function Dock({ header, floating = false }: Props) {
  const active = dockPanel.value;
  const { View } = DOCK_PANELS[active];

  return (
    <aside
      class={cn(
        "relative flex h-full w-full flex-col overflow-hidden border-r border-border transition-[border-radius,box-shadow,background-color] duration-(--apex-dock)",
        floating
          ? "rounded-r-xl bg-bg shadow-[8px_0_28px_rgba(0,0,0,0.28)]"
          : "rounded-none bg-surface shadow-none",
      )}
    >
      <div
        data-tauri-drag-region
        class="flex h-9 shrink-0 select-none items-center"
        style={{ paddingLeft: "max(var(--apex-controls-start, 0px), 0.75rem)" }}
      >
        {header}
      </div>

      {DOCK_PANEL_ORDER.length > 1 && (
        <nav class="flex min-h-8.5 shrink-0 gap-1 border-b border-border px-1 py-1">
          {DOCK_PANEL_ORDER.map((id) => {
            const entry = DOCK_PANELS[id];
            return (
              <button
                key={id}
                type="button"
                title={entry.label()}
                onClick={() => setDockPanel(id)}
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
            );
          })}
        </nav>
      )}

      <DockResize />

      <div class="min-h-0 flex-1">
        <View />
      </div>
    </aside>
  );
}
