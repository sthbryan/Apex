import { Suspense } from "preact/compat";

import { DockResize } from "@/app/layout/DockResize";
import { DOCK_PANELS } from "@/app/layout/panels";
import { dockOrder, dockPanel } from "@/app/layout/state";
import { t } from "@/shared/i18n";

export function Dock() {
  const order = dockOrder.value;
  const active = order.includes(dockPanel.value) ? dockPanel.value : order[0];
  const View = active ? DOCK_PANELS[active].View : null;

  return (
    <div class="relative flex h-full min-h-0 flex-col">
      <DockResize />

      <div class="min-h-0 flex-1 overflow-hidden">
        {View && active ? (
          <div key={active} class="h-full animate-view-in">
            <Suspense fallback={<p class="p-3 text-faint">{t("dock.loading")}</p>}>
              <View />
            </Suspense>
          </div>
        ) : (
          <p class="p-3 text-faint">{t("dock.empty")}</p>
        )}
      </div>
    </div>
  );
}
