import cn from "cnfast";
import { useState } from "preact/hooks";

import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import { openExternally } from "@/features/files/editors";
import { FileView } from "@/features/files/FileView";
import { DiffView } from "@/features/git/DiffView";
import { activeProject } from "@/features/projects/state";
import { TerminalView } from "@/features/sessions/TerminalView";
import {
  type DropEdge,
  draggedPane,
  EDGE_CLASS,
  edgeAt,
  type PaneDrag,
} from "@/features/workspace/drag";
import { PaneBar } from "@/features/workspace/PaneBar";
import { SplitDivider } from "@/features/workspace/SplitDivider";
import { focusLeaf, movePane } from "@/features/workspace/state";
import type { Leaf, PaneNode } from "@/features/workspace/tree";
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
    return <PaneLeaf tabId={tabId} node={node} focused={tabActive && node.id === activeLeafId} />;
  }

  const horizontal = node.direction === "row" || node.direction === "row-reverse";
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

function PaneLeaf({ tabId, node, focused }: { tabId: string; node: Leaf; focused: boolean }) {
  const [reload, setReload] = useState(0);
  const projectId = activeProject.value?.id ?? null;
  const dragged = draggedPane.value;
  const droppable = dragged !== null && dragged.leafId !== node.id;

  return (
    <div
      class={cn(
        "group relative flex h-full w-full flex-col overflow-hidden border transition-colors",
        focused ? "border-focus" : "border-transparent",
      )}
      tabIndex={-1}
      onFocusCapture={() => focusLeaf(tabId, node.id)}
      onMouseDown={() => focusLeaf(tabId, node.id)}
    >
      <PaneBar
        tabId={tabId}
        leaf={node}
        extra={
          node.view.type === "file" ? (
            <FileExtras
              path={node.view.path}
              projectId={projectId}
              onReload={() => setReload((tick) => tick + 1)}
            />
          ) : node.view.type === "diff" ? (
            <button
              type="button"
              title={t("git.reload")}
              onClick={() => setReload((tick) => tick + 1)}
              class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
            >
              <Icon name="refresh" size={12} />
            </button>
          ) : null
        }
      />
      <div class="min-h-0 flex-1">
        {node.view.type === "session" && <TerminalView id={node.view.sessionId} active={focused} />}
        {node.view.type === "file" && (
          <FileView key={reload} path={node.view.path} chrome={false} />
        )}
        {node.view.type === "diff" && (
          <DiffView
            key={reload}
            target={node.view.target}
            path={node.view.path}
            commit={node.view.commit}
            chrome={false}
          />
        )}
        {node.view.type === "panel" && <DockPanelView id={node.view.panel} />}
      </div>
      {droppable && dragged && <DropZone tabId={tabId} leafId={node.id} source={dragged} />}
    </div>
  );
}

function DropZone({ tabId, leafId, source }: { tabId: string; leafId: string; source: PaneDrag }) {
  const [edge, setEdge] = useState<DropEdge | null>(null);

  return (
    <div
      class="absolute inset-0 z-20"
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        setEdge(edgeAt(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY));
      }}
      onDragLeave={() => setEdge(null)}
      onDrop={(event) => {
        event.preventDefault();
        const where =
          edge ?? edgeAt(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
        setEdge(null);
        draggedPane.value = null;
        movePane(source, tabId, leafId, where);
      }}
    >
      {edge && <div class={cn("absolute border border-focus bg-focus/15", EDGE_CLASS[edge])} />}
    </div>
  );
}

function FileExtras({
  path,
  projectId,
  onReload,
}: {
  path: string;
  projectId: string | null;
  onReload: () => void;
}) {
  return (
    <>
      <button
        type="button"
        title={t("files.reload")}
        onClick={onReload}
        class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
      >
        <Icon name="refresh" size={12} />
      </button>
      {projectId && (
        <button
          type="button"
          title={t("files.openExternally")}
          onClick={() => void openExternally(projectId, path)}
          class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
        >
          <Icon name="externalApp" size={12} />
        </button>
      )}
    </>
  );
}

function DockPanelView({ id }: { id: string }) {
  const entry = DOCK_PANELS[id as DockPanel];
  if (!entry) {
    return null;
  }
  const { View } = entry;
  return (
    <div class="h-full overflow-auto bg-bg">
      <View />
    </div>
  );
}
