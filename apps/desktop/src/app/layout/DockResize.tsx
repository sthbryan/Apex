import {
  DOCK_WIDTH_MAX,
  DOCK_WIDTH_MIN,
  dockResizing,
  dockWidth,
  resetDockWidth,
  setDockWidth,
} from "@/app/layout/state";
import { dragging } from "@/features/workspace/state";
import { t } from "@/shared/i18n";

export function DockResize() {
  const startDrag = (event: MouseEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const origin = event.clientX;
    const start = dockWidth.value;
    dockResizing.value = true;
    dragging.value = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const move = (moved: MouseEvent) => {
      setDockWidth(start + (moved.clientX - origin));
    };
    const stop = () => {
      dockResizing.value = false;
      dragging.value = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  };

  const nudge = (event: KeyboardEvent) => {
    const step = STEPS[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    setDockWidth(dockWidth.value + step);
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={t("dock.resize")}
      aria-orientation="vertical"
      aria-valuemin={DOCK_WIDTH_MIN}
      aria-valuemax={DOCK_WIDTH_MAX}
      aria-valuenow={dockWidth.value}
      title={t("dock.resize")}
      onMouseDown={startDrag}
      onDblClick={resetDockWidth}
      onKeyDown={nudge}
      class="ui-side-panel-grip"
      data-dragging={dockResizing.value || undefined}
    />
  );
}

const STEPS: Record<string, number> = {
  ArrowLeft: -16,
  ArrowRight: 16,
};
