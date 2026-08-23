import { Suspense } from "preact/compat";
import { useState } from "preact/hooks";

import { popPanelToTab } from "@/app/layout/actions";
import { DockChrome } from "@/app/layout/DockChrome";
import { DockResize } from "@/app/layout/DockResize";
import { DOCK_PANELS } from "@/app/layout/panels";
import { dockOrder, dockPanel } from "@/app/layout/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function Dock() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const order = dockOrder.value;
  const active = order.includes(dockPanel.value) ? dockPanel.value : order[0];
  const View = active ? DOCK_PANELS[active].View : null;

  return (
    <div class="relative flex h-full min-h-0 flex-col">
      {active && (
        <div class="flex min-h-8.5 shrink-0 items-center gap-1.5 border-b border-border px-2.5">
          <span class="truncate text-text">{DOCK_PANELS[active].label()}</span>
          <div ref={setSlot} class="ml-auto flex shrink-0 items-center gap-1.5" />
          <button
            type="button"
            title={t("dock.popOut")}
            onClick={() => popPanelToTab(active)}
            class="shrink-0 text-faint transition-colors hover:text-text"
          >
            <Icon name="external" size={12} />
          </button>
        </div>
      )}

      <DockResize />

      <div class="min-h-0 flex-1 overflow-hidden">
        <DockChrome.Provider value={slot}>
          {View && active ? (
            <div key={active} class="h-full animate-view-in">
              <Suspense fallback={<p class="p-3 text-faint">{t("dock.loading")}</p>}>
                <View />
              </Suspense>
            </div>
          ) : (
            <p class="p-3 text-faint">{t("dock.empty")}</p>
          )}
        </DockChrome.Provider>
      </div>
    </div>
  );
}
