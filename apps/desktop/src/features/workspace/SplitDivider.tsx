import cn from "cnfast";
import { useRef } from "preact/hooks";

import { dragging, resizeSplit } from "@/features/workspace/state";
import { clampRatio } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";

type Props = {
  tabId: string;
  splitId: string;
  horizontal: boolean;
  ratio: number;
};

export function SplitDivider({ tabId, splitId, horizontal, ratio }: Props) {
  const handle = useRef<HTMLDivElement>(null);

  const startDrag = (event: MouseEvent) => {
    event.preventDefault();
    const parent = handle.current?.parentElement;
    if (!parent) {
      return;
    }
    const bounds = parent.getBoundingClientRect();

    const move = (moved: MouseEvent) => {
      const next = horizontal
        ? (moved.clientX - bounds.left) / bounds.width
        : (moved.clientY - bounds.top) / bounds.height;
      resizeSplit(tabId, splitId, clampRatio(next));
    };
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      document.body.style.cursor = "";
      dragging.value = false;
    };

    dragging.value = true;
    document.body.style.cursor = horizontal ? "col-resize" : "row-resize";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  };

  const nudge = (event: KeyboardEvent) => {
    const step = STEPS[event.key];
    if (step === undefined || step.horizontal !== horizontal) {
      return;
    }
    event.preventDefault();
    resizeSplit(tabId, splitId, clampRatio(ratio + step.delta));
  };

  return (
    <div
      ref={handle}
      role="separator"
      tabIndex={0}
      aria-label={t("workspace.resize")}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={10}
      aria-valuemax={90}
      onKeyDown={nudge}
      onMouseDown={startDrag}
      class={cn(
        "relative z-10 shrink-0",
        horizontal ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize",
      )}
    >
      <div
        class={cn(
          "absolute bg-border transition-colors hover:bg-accent",
          horizontal
            ? "inset-y-0 left-1/2 w-px -translate-x-1/2 hover:w-0.5"
            : "inset-x-0 top-1/2 h-px -translate-y-1/2 hover:h-0.5",
        )}
      />
    </div>
  );
}

const STEPS: Record<string, { horizontal: boolean; delta: number }> = {
  ArrowLeft: { horizontal: true, delta: -0.02 },
  ArrowRight: { horizontal: true, delta: 0.02 },
  ArrowUp: { horizontal: false, delta: -0.02 },
  ArrowDown: { horizontal: false, delta: 0.02 },
};
