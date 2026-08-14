import cn from "cnfast";
import { useRef } from "preact/hooks";
import { resizeSplit } from "@/features/workspace/state";
import { clampRatio } from "@/features/workspace/tree";

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
    };

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
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      onKeyDown={nudge}
      onMouseDown={startDrag}
      class={cn(
        "shrink-0 bg-border transition-[background-color,box-shadow] hover:bg-accent hover:shadow-[0_0_0_1px_var(--apex-accent)]",
        horizontal ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
      )}
    />
  );
}

const STEPS: Record<string, { horizontal: boolean; delta: number }> = {
  ArrowLeft: { horizontal: true, delta: -0.02 },
  ArrowRight: { horizontal: true, delta: 0.02 },
  ArrowUp: { horizontal: false, delta: -0.02 },
  ArrowDown: { horizontal: false, delta: 0.02 },
};
