import cn from "cnfast";
import { FileView } from "@/features/files/FileView";
import { DiffView } from "@/features/git/DiffView";
import { TerminalView } from "@/features/sessions/TerminalView";
import { SplitDivider } from "@/features/workspace/SplitDivider";
import { closePane, focusLeaf } from "@/features/workspace/state";
import type { PaneNode } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

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
          "group relative h-full w-full overflow-hidden border transition-colors",
          focused ? "border-focus" : "border-transparent",
        )}
        tabIndex={-1}
        onFocusCapture={() => focusLeaf(tabId, node.id)}
        onMouseDown={() => focusLeaf(tabId, node.id)}
      >
        {node.view.type === "session" && <TerminalView id={node.view.sessionId} active={focused} />}
        {node.view.type === "file" && <FileView path={node.view.path} />}
        {node.view.type === "diff" && (
          <DiffView target={node.view.target} path={node.view.path} commit={node.view.commit} />
        )}
        <button
          type="button"
          title={t("workspace.closePane")}
          onClick={() => closePane(tabId, node, true)}
          class="absolute top-1 right-1 z-10 flex size-5 items-center justify-center rounded bg-surface/90 text-faint opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-text focus-visible:opacity-100"
        >
          <Icon name="close" size={12} />
        </button>
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
