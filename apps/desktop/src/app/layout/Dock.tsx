import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { Suspense } from "preact/compat";
import { useState } from "preact/hooks";

import { popPanelToTab } from "@/app/layout/actions";
import { DockChrome } from "@/app/layout/DockChrome";
import { DockResize } from "@/app/layout/DockResize";
import { DOCK_PANELS } from "@/app/layout/panels";
import { dockOrder, dockPanel, setDockPanel } from "@/app/layout/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  header?: ComponentChildren;
  children?: ComponentChildren;
  floating?: boolean;
};

export function Dock({ header, children, floating = false }: Props) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const order = dockOrder.value;
  const active = order.includes(dockPanel.value) ? dockPanel.value : order[0];
  const View = active ? DOCK_PANELS[active].View : null;

  return (
    <aside
      class={cn(
        "relative flex h-full w-full flex-col overflow-hidden border-r border-border transition-[border-radius,box-shadow,background-color] duration-(--apex-dock)",
        floating
          ? "rounded-r-xl bg-chrome shadow-[8px_0_28px_rgba(0,0,0,0.28)]"
          : "rounded-none bg-chrome shadow-none",
      )}
    >
      <div
        data-tauri-drag-region
        class="flex h-9 shrink-0 select-none items-center"
        style={{ paddingLeft: "max(var(--apex-controls-start, 0px), 0.75rem)" }}
      >
        {header}
      </div>

      {children && <div class="shrink-0 pb-1">{children}</div>}

      {order.length > 0 && (
        <nav
          aria-label={t("dock.panels")}
          class="flex min-h-8.5 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-1 py-1 [scrollbar-width:none]"
        >
          {order.map((id) => {
            const entry = DOCK_PANELS[id];
            const current = active === id;
            return (
              <button
                key={id}
                type="button"
                title={entry.label()}
                aria-current={current ? "true" : undefined}
                onClick={() => setDockPanel(id)}
                onDblClick={() => popPanelToTab(id)}
                class={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded transition-colors",
                  current
                    ? "text-accent"
                    : floating
                      ? "text-muted hover:text-text"
                      : "text-faint hover:text-text",
                )}
              >
                <Icon name={entry.icon} />
                {current && (
                  <span
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-x-1 -bottom-1 h-0.5 rounded-full bg-accent"
                  />
                )}
              </button>
            );
          })}

          <div ref={setSlot} class="ml-auto flex shrink-0 items-center gap-1.5 pl-1" />

          {active && (
            <button
              type="button"
              title={t("dock.popOut")}
              onClick={() => popPanelToTab(active)}
              class="shrink-0 text-faint transition-colors hover:text-text"
            >
              <Icon name="external" size={12} />
            </button>
          )}
        </nav>
      )}

      <DockResize />

      <div class="min-h-0 flex-1 overflow-hidden">
        <DockChrome.Provider value={slot}>
          {View && active ? (
            <div key={active} class="h-full animate-dock-view">
              <Suspense fallback={<p class="p-3 text-faint">{t("dock.loading")}</p>}>
                <View />
              </Suspense>
            </div>
          ) : (
            <p class="p-3 text-faint">{t("dock.empty")}</p>
          )}
        </DockChrome.Provider>
      </div>
    </aside>
  );
}
