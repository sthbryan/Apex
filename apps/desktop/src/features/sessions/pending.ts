import { signal } from "@preact/signals";

import type { AgentMode } from "@/bindings/AgentMode";
import type { Isolation } from "@/bindings/Isolation";
import type { SessionSummary } from "@/bindings/SessionSummary";
import type { WorktreeDisposal } from "@/bindings/WorktreeDisposal";
import { activeProjectId } from "@/features/projects/state";
import { closeSession, createSession, sessions } from "@/features/sessions/state";
import { modeOf } from "@/features/settings/agentMode";
import {
  buildLayout,
  countPanes,
  LAYOUT_PRESETS,
  type LayoutSpec,
} from "@/features/workspace/layouts";
import {
  activeTab,
  dropSession,
  openInNewTab,
  replaceTabRoot,
  splitActive,
  splitLeafWithView,
  tabs,
  whenClosingSession,
} from "@/features/workspace/state";
import { type Direction, findLeaf, leaves, type PaneView } from "@/features/workspace/tree";
import { agents, complain } from "@/shared/daemon";

export type PendingSession = {
  id: number;
  project: string;
  agent: string;
  direction: Direction | null;
  isGit: boolean;
};

const SHELL = "shell";

export const pendingSession = signal<PendingSession | null>(null);

export function requestSession(request: Omit<PendingSession, "id">): void {
  if (!request.isGit) {
    void startSession({ ...request, id: 0 }, "directory", null, chosenMode(request.agent)).catch(
      complain,
    );
    return;
  }
  requests += 1;
  pendingSession.value = { ...request, id: requests };
}

function chosenMode(agent: string): AgentMode {
  const profile = agents.value.find((candidate) => candidate.name === agent);
  return modeOf(agent, profile?.mode ?? "pty");
}

let requests = 0;

export function cancelSession(): void {
  pendingSession.value = null;
}

export async function startSession(
  request: PendingSession,
  isolation: Isolation,
  slug: string | null = null,
  mode: AgentMode | null = null,
): Promise<void> {
  pendingSession.value = null;
  const created = await createSession(
    request.project,
    request.agent,
    { rows: 24, cols: 80 },
    isolation,
    null,
    slug,
    mode,
  );
  if (request.direction) {
    splitActive({ type: "session", sessionId: created.id }, request.direction);
  } else {
    openInNewTab(created);
  }
}

export type PendingClose = {
  id: number;
  sessionId: string;
  title: string;
  branch: string;
};

export const pendingClose = signal<PendingClose | null>(null);

export function requestClose(session: SessionSummary): void {
  if (!session.worktree) {
    void finishClose(session.id, "keep");
    return;
  }
  requests += 1;
  pendingClose.value = {
    id: requests,
    sessionId: session.id,
    title: session.title,
    branch: session.worktree.branch,
  };
}

export function cancelClose(): void {
  pendingClose.value = null;
}

export async function finishClose(sessionId: string, disposal: WorktreeDisposal): Promise<void> {
  pendingClose.value = null;
  dropSession(sessionId);
  await closeSession(sessionId, disposal);
}

export async function splitWithShell(direction: Direction): Promise<void> {
  const tab = activeTab.value;
  if (!tab) {
    return;
  }
  await splitWithShellAt(tab.id, tab.activeLeafId, direction);
}

export async function splitWithShellAt(
  tabId: string,
  leafId: string,
  direction: Direction,
): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  const tab = tabs.value.find((candidate) => candidate.id === tabId);
  const pane = tab ? findLeaf(tab.root, leafId) : null;
  if (!tab || !pane) {
    return;
  }
  const seedId = pane.view.type === "session" ? pane.view.sessionId : null;
  const beside = seedId ? sessions.value.find((candidate) => candidate.id === seedId) : null;
  const created = await createSession(
    project,
    SHELL,
    { rows: 24, cols: 80 },
    "directory",
    beside?.cwd ?? null,
  );
  splitLeafWithView(tabId, leafId, { type: "session", sessionId: created.id }, direction);
}

export async function applyLayout(spec: LayoutSpec): Promise<void> {
  const tab = activeTab.value;
  if (!tab) {
    return;
  }
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  const existing = leaves(tab.root);
  const seed = existing.find((pane) => pane.id === tab.activeLeafId) ?? existing[0];
  if (!seed) {
    return;
  }
  const slots = countPanes(spec);
  const views: PaneView[] = [seed.view];
  for (const pane of existing) {
    if (pane.id !== seed.id) {
      views.push(pane.view);
    }
  }
  if (views.length > slots) {
    return;
  }
  const created: SessionSummary[] = [];
  try {
    const seedId = seed.view.type === "session" ? seed.view.sessionId : null;
    const beside = seedId ? sessions.value.find((candidate) => candidate.id === seedId) : null;
    while (views.length < slots) {
      const session = await createSession(
        project,
        SHELL,
        { rows: 24, cols: 80 },
        "directory",
        beside?.cwd ?? null,
      );
      created.push(session);
      views.push({ type: "session", sessionId: session.id });
    }
  } catch {
    for (const session of created) {
      void closeSession(session.id);
    }
    return;
  }
  const root = buildLayout(spec, views);
  const first = leaves(root)[0];
  replaceTabRoot(tab.id, root, first?.id ?? tab.activeLeafId);
}

let layoutCycle = 0;

export function cycleLayout(): void {
  const tab = activeTab.value;
  if (!tab) {
    return;
  }
  const slots = leaves(tab.root).length;
  for (let step = 1; step <= LAYOUT_PRESETS.length; step += 1) {
    const index = (layoutCycle + step) % LAYOUT_PRESETS.length;
    const preset = LAYOUT_PRESETS[index];
    if (countPanes(preset.spec) >= slots) {
      layoutCycle = index;
      void applyLayout(preset.spec);
      return;
    }
  }
}

whenClosingSession((sessionId) => {
  const session = sessions.value.find((candidate) => candidate.id === sessionId);
  if (session) {
    requestClose(session);
  } else {
    void closeSession(sessionId);
  }
});
