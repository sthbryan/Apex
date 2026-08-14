import cn from "cnfast";
import { TerminalView } from "@/features/sessions/TerminalView";
import { SplitDivider } from "@/features/workspace/SplitDivider";
import { focusLeaf } from "@/features/workspace/state";
import type { PaneNode } from "@/features/workspace/tree";

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
      <SplitDivider tabId={tabId} splitId={node.id} horizontal={horizontal} ratio={node.ratio} />
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
