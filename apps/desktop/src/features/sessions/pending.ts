import { signal } from "@preact/signals";

import type { Isolation } from "@/bindings/Isolation";
import type { SessionSummary } from "@/bindings/SessionSummary";
import type { WorktreeDisposal } from "@/bindings/WorktreeDisposal";
import { closeSession, createSession, sessions } from "@/features/sessions/state";
import {
  dropSession,
  openInNewTab,
  splitActive,
  whenClosingSession,
} from "@/features/workspace/state";
import type { Direction } from "@/features/workspace/tree";

export type PendingSession = {
  id: number;
  project: string;
  agent: string;
  direction: Direction | null;
  isGit: boolean;
};

export const pendingSession = signal<PendingSession | null>(null);

export function requestSession(request: Omit<PendingSession, "id">): void {
  if (!request.isGit) {
    void startSession({ ...request, id: 0 }, "directory");
    return;
  }
  requests += 1;
  pendingSession.value = { ...request, id: requests };
}

let requests = 0;

export function cancelSession(): void {
  pendingSession.value = null;
}

export async function startSession(request: PendingSession, isolation: Isolation): Promise<void> {
  pendingSession.value = null;
  const created = await createSession(
    request.project,
    request.agent,
    { rows: 24, cols: 80 },
    isolation,
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

whenClosingSession((sessionId) => {
  const session = sessions.value.find((candidate) => candidate.id === sessionId);
  if (session) {
    requestClose(session);
  } else {
    void closeSession(sessionId);
  }
});
