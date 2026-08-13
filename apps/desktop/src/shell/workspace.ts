import { computed, signal } from "@preact/signals";

import type { SessionSummary } from "../bindings/SessionSummary";
import { closeSession, createSession } from "../sessions";
import {
  type Direction,
  type Leaf,
  type PaneNode,
  findLeaf,
  leaf,
  leaves,
  neighbourLeaf,
  newId,
  removeLeaf,
  setRatio,
  splitLeaf,
} from "./tree";

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
  return findLeaf(tab.root, tab.activeLeafId)?.sessionId ?? null;
});

export function openInNewTab(session: SessionSummary): void {
  const root = leaf(session.id);
  const tab: Tab = { id: newId(), root, activeLeafId: root.id };
  tabs.value = [...tabs.value, tab];
  activeTabId.value = tab.id;
}

export function focusSession(sessionId: string): boolean {
  for (const tab of tabs.value) {
    const match = leaves(tab.root).find((candidate) => candidate.sessionId === sessionId);
    if (match) {
      activeTabId.value = tab.id;
      updateTab(tab.id, (current) => ({ ...current, activeLeafId: match.id }));
      return true;
    }
  }
  return false;
}

export function splitActive(session: SessionSummary, direction: Direction): void {
  const tab = activeTab.value;
  if (!tab) {
    openInNewTab(session);
    return;
  }
  const incoming = leaf(session.id);
  updateTab(tab.id, (current) => ({
    ...current,
    root: splitLeaf(current.root, current.activeLeafId, direction, incoming),
    activeLeafId: incoming.id,
  }));
}

export async function splitWithNewSession(agent: string, direction: Direction): Promise<void> {
  const created = await createSession(agent, { rows: 24, cols: 80 });
  splitActive(created, direction);
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
  if (terminate) {
    void closeSession(target.sessionId);
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
    const match = leaves(tab.root).find((candidate) => candidate.sessionId === sessionId);
    if (match) {
      closePane(tab.id, match, false);
    }
  }
}

function updateTab(tabId: string, change: (tab: Tab) => Tab): void {
  tabs.value = tabs.value.map((tab) => (tab.id === tabId ? change(tab) : tab));
}
