import { computed, signal } from "@preact/signals";

import { reconcileDock, returnPanelToDock } from "@/app/layout/state";
import type { GitTarget } from "@/bindings/GitTarget";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { gitTarget, sameTarget, selectTarget } from "@/features/git/state";
import { sessions } from "@/features/sessions/state";
import { splitCaps } from "@/features/settings/agentMode";

let onCloseRequest: ((sessionId: string) => void) | null = null;

export function whenClosingSession(handler: (sessionId: string) => void): void {
  onCloseRequest = handler;
}

import {
  type Direction,
  findLeaf,
  type Leaf,
  leaf,
  leaves,
  neighbourLeaf,
  newId,
  type PaneNode,
  type PaneView,
  referencedSession,
  removeLeaf,
  sessionOf,
  setRatio,
  setView,
  siblingOf,
  splitLeaf,
  swapViews,
  withMain,
} from "@/features/workspace/tree";

export type Tab = {
  id: string;
  root: PaneNode;
  activeLeafId: string;
};

export const tabs = signal<Tab[]>([]);
export const activeTabId = signal<string | null>(null);

export const activeTab = computed(
  () => tabs.value.find((tab) => tab.id === activeTabId.value) ?? null,
);

export const activeSessionId = computed(() => {
  const tab = activeTab.value;
  if (!tab) {
    return null;
  }
  const pane = findLeaf(tab.root, tab.activeLeafId);
  return pane ? sessionOf(pane) : null;
});

export const activeCommit = computed(() => {
  const tab = activeTab.value;
  if (!tab) {
    return null;
  }
  const current = findLeaf(tab.root, tab.activeLeafId);
  if (current?.view.type === "diff" && current.view.commit) {
    return current.view.commit;
  }
  const shown = leaves(tab.root).find(
    (pane) => pane.view.type === "diff" && pane.view.commit !== null,
  );
  return shown?.view.type === "diff" ? shown.view.commit : null;
});

export const visibleSessions = computed(() => {
  const tab = activeTab.value;
  if (!tab) {
    return new Set<string>();
  }
  const shown = leaves(tab.root)
    .map(sessionOf)
    .filter((id): id is string => id !== null);
  return new Set(shown);
});

export function openInNewTab(session: SessionSummary): void {
  openView({ type: "session", sessionId: session.id });
}

export function openDiff(target: GitTarget, path: string, commit: string | null = null): void {
  openBeside({ type: "diff", target, path, commit }, (view) => view.type === "diff");
}

export function openFile(path: string): void {
  openBeside({ type: "file", path }, (view) => view.type === "file");
}

export function openRaceView(run: string): void {
  openBeside({ type: "race", run }, (view) => view.type === "race");
}

export function openBrowser(url: string): void {
  openBeside({ type: "browser", url }, (view) => view.type === "browser");
}

function openBeside(view: PaneView, replaceable: (view: PaneView) => boolean): void {
  if (focusPane((candidate) => same(candidate, view))) {
    return;
  }
  const tab = activeTab.value;
  if (!tab) {
    openView(view);
    return;
  }
  const current = findLeaf(tab.root, tab.activeLeafId);
  if (current && replaceable(current.view)) {
    updateTab(tab.id, (state) => ({
      ...state,
      root: setView(state.root, state.activeLeafId, view),
    }));
    return;
  }
  splitActive(view, "row");
}

function same(left: PaneView, right: PaneView): boolean {
  if (left.type !== right.type) {
    return false;
  }
  if (left.type === "file" && right.type === "file") {
    return left.path === right.path;
  }
  if (left.type === "diff" && right.type === "diff") {
    return (
      left.path === right.path &&
      left.commit === right.commit &&
      sameTarget(left.target, right.target)
    );
  }
  if (left.type === "panel" && right.type === "panel") {
    return left.panel === right.panel;
  }
  if (left.type === "browser" && right.type === "browser") {
    return left.url === right.url;
  }
  if (left.type === "race" && right.type === "race") {
    return left.run === right.run;
  }
  return false;
}

export function openPanel(panel: string): void {
  if (focusPane((view) => view.type === "panel" && view.panel === panel)) {
    return;
  }
  openView({ type: "panel", panel });
}

export function closePanelViews(panel: string): void {
  const hits: { tabId: string; pane: Leaf }[] = [];
  for (const tab of tabs.value) {
    for (const pane of leaves(tab.root)) {
      if (pane.view.type === "panel" && pane.view.panel === panel) {
        hits.push({ tabId: tab.id, pane });
      }
    }
  }
  for (const hit of hits) {
    closePane(hit.tabId, hit.pane, false);
  }
}

export function panelIdsInWorkspace(): string[] {
  const ids: string[] = [];
  for (const tab of tabs.value) {
    for (const pane of leaves(tab.root)) {
      if (pane.view.type === "panel") {
        ids.push(pane.view.panel);
      }
    }
  }
  return ids;
}

export function focusSession(sessionId: string): boolean {
  return focusPane((view) => view.type === "session" && view.sessionId === sessionId);
}

export function splitActive(view: PaneView, direction: Direction): void {
  const tab = activeTab.value;
  if (!tab) {
    openView(view);
    return;
  }
  const incoming = leaf(view);
  updateTab(tab.id, (current) => ({
    ...current,
    root: splitLeaf(current.root, current.activeLeafId, direction, incoming),
    activeLeafId: incoming.id,
  }));
}

export function splitLeafWithView(
  tabId: string,
  leafId: string,
  view: PaneView,
  direction: Direction,
): void {
  const incoming = leaf(view);
  updateTab(tabId, (current) => ({
    ...current,
    root: splitLeaf(current.root, leafId, direction, incoming),
    activeLeafId: incoming.id,
  }));
}

export function replaceTabRoot(tabId: string, root: PaneNode, activeLeafId: string): void {
  updateTab(tabId, (current) => ({ ...current, root, activeLeafId }));
}

function openView(view: PaneView, focus = true): string {
  const root = leaf(view);
  const tab: Tab = { id: newId(), root, activeLeafId: root.id };
  tabs.value = [...tabs.value, tab];
  if (focus) {
    activeTabId.value = tab.id;
  }
  return tab.id;
}

let spareTabId: string | null = null;

export function openQuietly(view: PaneView, asSplit: boolean): void {
  if (!asSplit) {
    openView(view, false);
    return;
  }

  const yours = activeTab.value;
  if (yours && yours.id !== spareTabId && leaves(yours.root).length < splitCaps.value.yours) {
    splitQuietly(yours, view);
    return;
  }

  const spare = tabs.value.find((tab) => tab.id === spareTabId);
  if (spare && leaves(spare.root).length < splitCaps.value.spare) {
    splitQuietly(spare, view);
    return;
  }

  spareTabId = openView(view, false);
}

function parentLeafOf(tab: Tab, view: PaneView): Leaf | null {
  if (view.type !== "session") {
    return null;
  }
  const parent = sessions.value.find((session) => session.id === view.sessionId)?.parent;
  if (!parent) {
    return null;
  }
  return leaves(tab.root).find((pane) => sessionOf(pane) === parent) ?? null;
}

function splitQuietly(tab: Tab, view: PaneView): void {
  const incoming = leaf(view);
  const mainId = parentLeafOf(tab, view)?.id ?? null;
  if (!mainId) {
    const direction: Direction = leaves(tab.root).length % 2 === 1 ? "row" : "column";
    updateTab(tab.id, (current) => ({
      ...current,
      root: splitLeaf(current.root, current.activeLeafId, direction, incoming),
    }));
    return;
  }
  updateTab(tab.id, (current) => {
    const main = findLeaf(current.root, mainId);
    if (!main) {
      return current;
    }
    const others = leaves(current.root).filter((pane) => pane.id !== mainId);
    const splitId = current.root.kind === "split" ? current.root.id : undefined;
    return { ...current, root: withMain(main, [...others, incoming], "row", splitId) };
  });
}

function focusPane(matches: (view: PaneView) => boolean): boolean {
  for (const tab of tabs.value) {
    const match = leaves(tab.root).find((candidate) => matches(candidate.view));
    if (match) {
      activeTabId.value = tab.id;
      updateTab(tab.id, (current) => ({ ...current, activeLeafId: match.id }));
      return true;
    }
  }
  return false;
}

export type LayoutPayload = {
  tabs: Tab[];
  activeTabId: string | null;
};

export function serializeLayout(): string {
  const payload: LayoutPayload = { tabs: tabs.value, activeTabId: activeTabId.value };
  return JSON.stringify(payload);
}

export function restoreLayout(raw: string | null, liveSessionIds: Set<string>): void {
  const parsed = parseLayout(raw);
  const surviving = parsed.tabs
    .map((tab) => pruneTab(tab, liveSessionIds))
    .filter((tab): tab is Tab => tab !== null);

  tabs.value = surviving;
  activeTabId.value = surviving.some((tab) => tab.id === parsed.activeTabId)
    ? parsed.activeTabId
    : (surviving.at(-1)?.id ?? null);
  reconcileDock(panelIdsInWorkspace());
}

export function clearWorkspace(): void {
  tabs.value = [];
  activeTabId.value = null;
  reconcileDock([]);
}

function parseLayout(raw: string | null): LayoutPayload {
  if (!raw) {
    return { tabs: [], activeTabId: null };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LayoutPayload>;
    return {
      tabs: Array.isArray(parsed.tabs)
        ? parsed.tabs.map((tab) => ({ ...tab, root: adoptNode(tab.root) }))
        : [],
      activeTabId: typeof parsed.activeTabId === "string" ? parsed.activeTabId : null,
    };
  } catch {
    return { tabs: [], activeTabId: null };
  }
}

function adoptNode(node: PaneNode): PaneNode {
  if (node.kind === "leaf") {
    if (node.view) {
      return node;
    }
    const legacy = (node as unknown as { sessionId: string }).sessionId;
    return { kind: "leaf", id: node.id, view: { type: "session", sessionId: legacy } };
  }
  return { ...node, first: adoptNode(node.first), second: adoptNode(node.second) };
}

function pruneTab(tab: Tab, liveSessionIds: Set<string>): Tab | null {
  const root = pruneNode(tab.root, liveSessionIds);
  if (!root) {
    return null;
  }
  const remaining = leaves(root);
  const activeLeafId = remaining.some((pane) => pane.id === tab.activeLeafId)
    ? tab.activeLeafId
    : remaining[0].id;
  return { ...tab, root, activeLeafId };
}

function pruneNode(node: PaneNode, liveSessionIds: Set<string>): PaneNode | null {
  if (node.kind === "leaf") {
    const session = referencedSession(node);
    return session === null || liveSessionIds.has(session) ? node : null;
  }
  const first = pruneNode(node.first, liveSessionIds);
  const second = pruneNode(node.second, liveSessionIds);
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }
  return { ...node, first, second };
}

export function focusLeaf(tabId: string, leafId: string): void {
  activeTabId.value = tabId;
  updateTab(tabId, (current) => ({ ...current, activeLeafId: leafId }));
}

export function resizeSplit(tabId: string, splitId: string, ratio: number): void {
  updateTab(tabId, (current) => ({ ...current, root: setRatio(current.root, splitId, ratio) }));
}

export function closePane(
  tabId: string,
  target: Leaf,
  terminate: boolean,
  restoreToDock = true,
): void {
  const tab = tabs.value.find((candidate) => candidate.id === tabId);
  if (!tab) {
    return;
  }
  if (restoreToDock && target.view.type === "panel") {
    returnPanelToDock(target.view.panel);
  }
  const session = sessionOf(target);
  if (terminate && session) {
    onCloseRequest?.(session);
  }

  const fallback = neighbourLeaf(tab.root, target.id);
  const root = removeLeaf(tab.root, target.id);
  if (!root || !fallback) {
    closeTab(tabId);
    return;
  }
  updateTab(tabId, (current) => ({ ...current, root, activeLeafId: fallback.id }));
}

export function extractLeafToTab(tabId: string, leafId: string): void {
  const tab = tabs.value.find((candidate) => candidate.id === tabId);
  const pane = tab ? findLeaf(tab.root, leafId) : null;
  if (!tab || !pane || leaves(tab.root).length < 2) {
    return;
  }
  closePane(tabId, pane, false, false);
  openView(pane.view);
}

export function mergeTabInto(sourceTabId: string, targetTabId: string): void {
  if (sourceTabId === targetTabId) {
    return;
  }
  const source = tabs.value.find((tab) => tab.id === sourceTabId);
  const pane = source ? findLeaf(source.root, source.activeLeafId) : null;
  const target = tabs.value.find((tab) => tab.id === targetTabId);
  if (!source || !target || !pane) {
    return;
  }
  const incoming = leaf(pane.view);
  updateTab(targetTabId, (current) => ({
    ...current,
    root: splitLeaf(current.root, current.activeLeafId, "row", incoming),
    activeLeafId: incoming.id,
  }));
  closePane(sourceTabId, pane, false, false);
}

export function swapPaneWithSibling(tabId: string, leafId: string): void {
  const tab = tabs.value.find((candidate) => candidate.id === tabId);
  const sibling = tab ? siblingOf(tab.root, leafId) : null;
  if (!tab || !sibling) {
    return;
  }
  updateTab(tabId, (current) => ({
    ...current,
    root: swapViews(current.root, leafId, sibling.id),
  }));
}

export function closeTab(tabId: string, restorePanels = true): void {
  const tab = tabs.value.find((candidate) => candidate.id === tabId);
  if (restorePanels && tab) {
    for (const pane of leaves(tab.root)) {
      if (pane.view.type === "panel") {
        returnPanelToDock(pane.view.panel);
      }
    }
  }
  const remaining = tabs.value.filter((candidate) => candidate.id !== tabId);
  tabs.value = remaining;
  if (activeTabId.value === tabId) {
    activeTabId.value = remaining.at(-1)?.id ?? null;
  }
}

export function dropSession(sessionId: string): void {
  for (const tab of tabs.value) {
    const match = leaves(tab.root).find((candidate) => sessionOf(candidate) === sessionId);
    if (match) {
      closePane(tab.id, match, false);
    }
  }
}

function updateTab(tabId: string, change: (tab: Tab) => Tab): void {
  tabs.value = tabs.value.map((tab) => (tab.id === tabId ? change(tab) : tab));
}

activeSessionId.subscribe((sessionId) => {
  const worktree = sessions.value.find((session) => session.id === sessionId)?.worktree;
  if (!worktree) {
    return;
  }
  const wanted: GitTarget = { type: "worktree", path: worktree.path };
  if (!sameTarget(gitTarget.value, wanted)) {
    selectTarget(wanted);
  }
});
