import type { Signal } from "@preact/signals";

import { dragging } from "@/features/workspace/state";

export type Side = "left" | "right";

type Props = {
  side: Side;
  width: number;
  min: number;
  max: number;
  label: string;
  resizing: Signal<boolean>;
  onWidth: (px: number) => void;
  onReset: () => void;
};

export function nextWidth(side: Side, start: number, origin: number, at: number): number {
  const moved = at - origin;
  return side === "left" ? start + moved : start - moved;
}

export function SideResize({ side, width, min, max, label, resizing, onWidth, onReset }: Props) {
  const startDrag = (event: MouseEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const origin = event.clientX;
    const start = width;
    resizing.value = true;
    dragging.value = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const move = (moved: MouseEvent) => {
      onWidth(nextWidth(side, start, origin, moved.clientX));
    };
    const stop = () => {
      resizing.value = false;
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
    onWidth(width + (side === "left" ? step : -step));
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      title={label}
      onMouseDown={startDrag}
      onDblClick={onReset}
      onKeyDown={nudge}
      class="ui-side-panel-grip"
      data-dragging={resizing.value || undefined}
    />
  );
}

const STEPS: Record<string, number> = {
  ArrowLeft: -16,
  ArrowRight: 16,
};
