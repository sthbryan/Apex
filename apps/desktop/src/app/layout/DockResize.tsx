import { SideResize } from "@/app/layout/SideResize";
import {
  DOCK_WIDTH_MAX,
  DOCK_WIDTH_MIN,
  dockResizing,
  dockWidth,
  resetDockWidth,
  setDockWidth,
} from "@/app/layout/state";
import { t } from "@/shared/i18n";

export function DockResize() {
  return (
    <SideResize
      side="left"
      width={dockWidth.value}
      min={DOCK_WIDTH_MIN}
      max={DOCK_WIDTH_MAX}
      label={t("dock.resize")}
      resizing={dockResizing}
      onWidth={setDockWidth}
      onReset={resetDockWidth}
    />
  );
}
