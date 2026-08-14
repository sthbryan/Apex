import cn from "cnfast";
import { useState } from "preact/hooks";

import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import { openExternally } from "@/features/files/editors";
import { FileView } from "@/features/files/FileView";
import { DiffView } from "@/features/git/DiffView";
import { activeProject } from "@/features/projects/state";
import { TerminalView } from "@/features/sessions/TerminalView";
import { hasPaneDrag, hasTabDrag, readPaneDrag, readTabDrag } from "@/features/workspace/dnd";
import { PaneBar } from "@/features/workspace/PaneBar";
import { SplitDivider } from "@/features/workspace/SplitDivider";
import { focusLeaf, moveLeafTo, splitWithTab } from "@/features/workspace/state";
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

function PaneLeaf({ tabId, node, focused }: { tabId: string; node: Leaf; focused: boolean }) {
  const [reload, setReload] = useState(0);
  const projectId = activeProject.value?.id ?? null;

  return (
    <div
      class={cn(
        "group flex h-full w-full flex-col overflow-hidden border transition-colors",
        focused ? "border-focus" : "border-transparent",
      )}
      tabIndex={-1}
      onFocusCapture={() => focusLeaf(tabId, node.id)}
      onMouseDown={() => focusLeaf(tabId, node.id)}
      onDragOver={(event) => {
        if (hasPaneDrag(event) || hasTabDrag(event)) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const pane = readPaneDrag(event);
        if (pane) {
          event.preventDefault();
          moveLeafTo(pane.tabId, pane.leafId, tabId, node.id);
          return;
        }
        const sourceTab = readTabDrag(event);
        if (sourceTab) {
          event.preventDefault();
          splitWithTab(sourceTab, tabId, node.id);
        }
      }}
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
          <Icon name="external" size={12} />
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
