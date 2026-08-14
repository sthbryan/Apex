import { signal } from "@preact/signals";

import type { Isolation } from "@/bindings/Isolation";
import { createSession } from "@/features/sessions/state";
import { openInNewTab, splitActive } from "@/features/workspace/state";
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
