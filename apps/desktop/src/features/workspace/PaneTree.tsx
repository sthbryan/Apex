import cn from "cnfast";
import { useRef } from "preact/hooks";
import { TerminalView } from "@/features/sessions/TerminalView";
import { focusLeaf, resizeSplit } from "@/features/workspace/state";
import { clampRatio, type PaneNode } from "@/features/workspace/tree";

type Props = {
  tabId: string;
  node: PaneNode;
  activeLeafId: string;
  tabActive: boolean;
};

export function PaneTree({ tabId, node, activeLeafId, tabActive }: Props) {
  if (node.kind === "leaf") {
    const focused = tabActive && node.id === activeLeafId;
    return (
      <div
        class={cn(
          "h-full w-full overflow-hidden border transition-colors",
          focused ? "border-focus" : "border-transparent",
        )}
        tabIndex={-1}
        onFocusCapture={() => focusLeaf(tabId, node.id)}
        onMouseDown={() => focusLeaf(tabId, node.id)}
      >
        <TerminalView id={node.sessionId} active={focused} />
      </div>
    );
  }

  const horizontal = node.direction === "row";
  return (
    <div class={cn("flex h-full w-full", horizontal ? "flex-row" : "flex-col")}>
      <div style={{ flex: `${node.ratio} 1 0%`, minWidth: 0, minHeight: 0 }}>
        <PaneTree
          tabId={tabId}
          node={node.first}
          activeLeafId={activeLeafId}
          tabActive={tabActive}
        />
      </div>
      <Divider tabId={tabId} splitId={node.id} horizontal={horizontal} ratio={node.ratio} />
      <div style={{ flex: `${1 - node.ratio} 1 0%`, minWidth: 0, minHeight: 0 }}>
        <PaneTree
          tabId={tabId}
          node={node.second}
          activeLeafId={activeLeafId}
          tabActive={tabActive}
        />
      </div>
    </div>
  );
}

function Divider({
  tabId,
  splitId,
  horizontal,
  ratio,
}: {
  tabId: string;
  splitId: string;
  horizontal: boolean;
  ratio: number;
}) {
  const handle = useRef<HTMLDivElement>(null);

  const startDrag = (event: MouseEvent) => {
    event.preventDefault();
    const parent = handle.current?.parentElement;
    if (!parent) {
      return;
    }
    const bounds = parent.getBoundingClientRect();

    const move = (moved: MouseEvent) => {
      const ratio = horizontal
        ? (moved.clientX - bounds.left) / bounds.width
        : (moved.clientY - bounds.top) / bounds.height;
      resizeSplit(tabId, splitId, clampRatio(ratio));
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
