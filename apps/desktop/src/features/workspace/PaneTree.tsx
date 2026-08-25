import { Pane } from "@apex/ui";
import cn from "cnfast";
import { lazy, Suspense } from "preact/compat";
import { useCallback, useState } from "preact/hooks";

import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import { sessions as allSessions } from "@/features/sessions/state";
import { TerminalView } from "@/features/sessions/TerminalView";
import { PaneActions } from "@/features/workspace/PaneActions";
import { paneMenu } from "@/features/workspace/paneMenu";
import { SplitDivider } from "@/features/workspace/SplitDivider";
import type { PaneHosts } from "@/features/workspace/slots";
import { PaneSlots } from "@/features/workspace/slots";
import { focusLeaf } from "@/features/workspace/state";
import { paneIcon, paneSubtitle, paneTitle } from "@/features/workspace/title";
import type { Leaf, PaneNode } from "@/features/workspace/tree";
import { Boundary } from "@/shared/ui/Boundary";
import { editable, openMenu } from "@/shared/ui/ContextMenu";
import { Icon } from "@/shared/ui/Icon";

const AcpView = lazy(async () => ({ default: (await import("@/features/acp/AcpView")).AcpView }));
const FileView = lazy(async () => ({
  default: (await import("@/features/files/FileView")).FileView,
}));
const DiffView = lazy(async () => ({
  default: (await import("@/features/git/DiffView")).DiffView,
}));
const RaceView = lazy(async () => ({
  default: (await import("@/features/race/RaceView")).RaceView,
}));

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
  const [hosts, setHosts] = useState<PaneHosts>({
    lead: null,
    title: null,
    sub: null,
    controls: null,
  });
  const own = node.view.type === "browser";

  const holdLead = useCallback((el: HTMLElement | null) => {
    setHosts((current) => ({ ...current, lead: el }));
  }, []);
  const holdTitle = useCallback((el: HTMLElement | null) => {
    setHosts((current) => ({ ...current, title: el }));
  }, []);
  const holdSub = useCallback((el: HTMLElement | null) => {
    setHosts((current) => ({ ...current, sub: el }));
  }, []);
  const holdControls = useCallback((el: HTMLElement | null) => {
    setHosts((current) => ({ ...current, controls: el }));
  }, []);

  return (
    <Pane
      scroll={false}
      tabIndex={-1}
      wide={own}
      class={cn(
        "group h-full w-full overflow-hidden border transition-colors",
        focused ? "pane-focused border-border" : "border-transparent",
      )}
      onFocusCapture={() => focusLeaf(tabId, node.id)}
      onMouseDown={() => focusLeaf(tabId, node.id)}
      onContextMenu={(event) => {
        if (editable(event.target)) {
          return;
        }
        focusLeaf(tabId, node.id);
        openMenu(event, paneMenu(tabId, node));
      }}
      lead={
        own ? (
          <span ref={holdLead} class="flex flex-none items-center gap-0.5" />
        ) : (
          <Icon
            name={paneIcon(node.view)}
            size={12}
            class={cn("shrink-0", focused ? "text-accent" : "text-faint")}
          />
        )
      }
      title={
        own ? (
          <span ref={holdTitle} class="flex min-w-0 flex-1 items-center" />
        ) : (
          paneTitle(node.view, allSessions.value)
        )
      }
      sub={
        <>
          {own ? null : paneSubtitle(node.view)}
          <span ref={holdSub} class="contents" />
        </>
      }
      controls={<span ref={holdControls} class="contents" />}
      actions={<PaneActions tabId={tabId} leaf={node} focused={focused} />}
    >
      <PaneSlots.Provider value={hosts}>
        <div class="min-h-0 flex-1">
          <Boundary key={node.id}>
            <Suspense fallback={<PanePlaceholder />}>
              {node.view.type === "session" && (
                <SessionView id={node.view.sessionId} focused={focused} />
              )}
              {node.view.type === "file" && <FileView path={node.view.path} />}
              {node.view.type === "diff" && (
                <DiffView
                  target={node.view.target}
                  path={node.view.path}
                  commit={node.view.commit}
                />
              )}
              {node.view.type === "panel" && <DockPanelView id={node.view.panel} />}
              {node.view.type === "race" && <RaceView run={node.view.run} />}
            </Suspense>
          </Boundary>
        </div>
      </PaneSlots.Provider>
    </Pane>
  );
}

function SessionView({ id, focused }: { id: string; focused: boolean }) {
  const session = allSessions.value.find((candidate) => candidate.id === id);
  if (session?.mode === "acp") {
    return <AcpView id={id} />;
  }
  return <TerminalView id={id} active={focused} />;
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

function PanePlaceholder() {
  return <div class="h-full w-full animate-pulse bg-bg" />;
}
