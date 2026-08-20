import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { Suspense } from "preact/compat";
import { useState } from "preact/hooks";

import { popPanelToTab } from "@/app/layout/actions";
import { DockChrome } from "@/app/layout/DockChrome";
import { DockResize } from "@/app/layout/DockResize";
import { DOCK_PANELS, type PanelBadge } from "@/app/layout/panels";
import {
  type DockPanel,
  dockOrder,
  dockPanel,
  setDockMode,
  setDockPanel,
} from "@/app/layout/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const BADGE_TONE: Record<PanelBadge, string> = {
  blocked: "bg-state-blocked",
  working: "bg-state-working",
  dirty: "bg-git-dirty",
};

type Props = {
  header?: ComponentChildren;
  children?: ComponentChildren;
  floating?: boolean;
  rail?: boolean;
};

export function Dock({ header, children, floating = false, rail = false }: Props) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const order = dockOrder.value;
  const active = order.includes(dockPanel.value) ? dockPanel.value : order[0];
  const View = active ? DOCK_PANELS[active].View : null;

  if (rail) {
    return (
      <aside class="flex h-full w-full flex-col bg-chrome">
        <div data-tauri-drag-region class="h-9 shrink-0 select-none" />
        <nav
          aria-label={t("dock.panels")}
          class="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto border-r border-border py-1 [scrollbar-width:none]"
        >
          {order.map((id) => (
            <PanelIcon
              key={id}
              id={id}
              current={active === id}
              badge={DOCK_PANELS[id].badge?.() ?? null}
              dim
              onPick={() => {
                setDockPanel(id);
                setDockMode("expanded");
              }}
            />
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside
      class={cn(
        "relative flex h-full w-full flex-col overflow-hidden border-r border-border transition-[border-radius,box-shadow,background-color] duration-(--apex-dock)",
        floating
          ? "rounded-r-xl bg-chrome shadow-[8px_0_28px_var(--apex-dock-shadow)]"
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
            const badge = entry.badge?.() ?? null;
            const current = active === id;
            return (
              <PanelIcon
                key={id}
                id={id}
                current={current}
                badge={badge}
                dim={!floating}
                onPick={() => setDockPanel(id)}
              />
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

type PanelIconProps = {
  id: DockPanel;
  current: boolean;
  badge: PanelBadge | null;
  dim: boolean;
  onPick: () => void;
};

function PanelIcon({ id, current, badge, dim, onPick }: PanelIconProps) {
  const entry = DOCK_PANELS[id];

  return (
    <button
      type="button"
      title={entry.label()}
      aria-current={current ? "true" : undefined}
      onClick={onPick}
      onDblClick={() => popPanelToTab(id)}
      class={cn(
        "relative flex size-6 shrink-0 items-center justify-center rounded transition-colors",
        current ? "text-accent" : dim ? "text-faint hover:text-text" : "text-muted hover:text-text",
      )}
    >
      <Icon name={entry.icon} />
      {badge && !current && (
        <span
          aria-hidden="true"
          class={cn(
            "absolute top-0.5 right-0.5 size-1.5 rounded-full ring-2 ring-chrome",
            BADGE_TONE[badge],
          )}
        />
      )}
      {current && (
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-x-1 -bottom-1 h-0.5 rounded-full bg-accent"
        />
      )}
    </button>
  );
}
