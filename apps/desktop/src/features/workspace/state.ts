import { computed, signal } from "@preact/signals";

import type { SessionSummary } from "@/bindings/SessionSummary";
import { closeSession, createSession } from "@/features/sessions/state";
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
  removeLeaf,
  sessionOf,
  setRatio,
  splitLeaf,
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

export function openInNewTab(session: SessionSummary): void {
  openView({ type: "session", sessionId: session.id });
}

export function openFile(path: string): void {
  if (focusPane((view) => view.type === "file" && view.path === path)) {
    return;
  }
  const tab = activeTab.value;
  if (tab) {
    splitActive({ type: "file", path }, "row");
    return;
  }
  openView({ type: "file", path });
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

function openView(view: PaneView): void {
  const root = leaf(view);
  const tab: Tab = { id: newId(), root, activeLeafId: root.id };
  tabs.value = [...tabs.value, tab];
  activeTabId.value = tab.id;
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

export async function splitWithNewSession(
  project: string,
  agent: string,
  direction: Direction,
): Promise<void> {
  const created = await createSession(project, agent, { rows: 24, cols: 80 });
  splitActive({ type: "session", sessionId: created.id }, direction);
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
}

export function clearWorkspace(): void {
  tabs.value = [];
  activeTabId.value = null;
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
    const session = sessionOf(node);
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

export function closePane(tabId: string, target: Leaf, terminate: boolean): void {
  const tab = tabs.value.find((candidate) => candidate.id === tabId);
  if (!tab) {
    return;
  }
  const session = sessionOf(target);
  if (terminate && session) {
    void closeSession(session);
  }

  const fallback = neighbourLeaf(tab.root, target.id);
  const root = removeLeaf(tab.root, target.id);
  if (!root || !fallback) {
    closeTab(tabId);
    return;
  }
  updateTab(tabId, (current) => ({ ...current, root, activeLeafId: fallback.id }));
}

export function closeTab(tabId: string): void {
  const remaining = tabs.value.filter((tab) => tab.id !== tabId);
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
