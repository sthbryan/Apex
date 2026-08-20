import { signal } from "@preact/signals";
import { Channel, invoke } from "@tauri-apps/api/core";

import type { AgentMode } from "@/bindings/AgentMode";
import type { Event } from "@/bindings/Event";
import type { Isolation } from "@/bindings/Isolation";
import type { SessionSummary } from "@/bindings/SessionSummary";
import type { TerminalSize } from "@/bindings/TerminalSize";
import type { WorktreeDisposal } from "@/bindings/WorktreeDisposal";
import { absorb, forget, offer } from "@/features/acp/state";
import { disposeTerminal } from "@/features/sessions/registry";
import { complain } from "@/shared/daemon";

const UUID_BYTES = 16;

type OutputListener = (data: Uint8Array) => void;

export const sessions = signal<SessionSummary[]>([]);

const listeners = new Map<string, Set<OutputListener>>();
const pendingOutput = new Map<string, Uint8Array[]>();
const suspended = new Set<string>();

export async function startSessionBridge(): Promise<void> {
  const output = new Channel<ArrayBuffer>();
  output.onmessage = (payload) => routeOutput(new Uint8Array(payload));
  await invoke("subscribe_output", { channel: output });

  const events = new Channel<Event>();
  events.onmessage = applyEvent;
  await invoke("subscribe_events", { channel: events });

  sessions.value = await invoke<SessionSummary[]>("list_sessions");
}

function routeOutput(payload: Uint8Array): void {
  if (payload.byteLength < UUID_BYTES) {
    return;
  }
  const id = decodeUuid(payload.subarray(0, UUID_BYTES));
  const data = payload.subarray(UUID_BYTES);

  const targets = listeners.get(id);
  if (!targets || targets.size === 0) {
    if (suspended.has(id)) {
      return;
    }
    const queued = pendingOutput.get(id) ?? [];
    queued.push(data);
    pendingOutput.set(id, queued);
    return;
  }
  for (const listener of targets) {
    listener(data);
  }
}

export function onSessionOutput(id: string, listener: OutputListener): () => void {
  const targets = listeners.get(id) ?? new Set<OutputListener>();
  targets.add(listener);
  listeners.set(id, targets);

  const queued = pendingOutput.get(id);
  if (queued) {
    pendingOutput.delete(id);
    for (const chunk of queued) {
      listener(chunk);
    }
  }

  return () => {
    targets.delete(listener);
    if (targets.size === 0) {
      listeners.delete(id);
    }
  };
}

const exitHandlers = new Set<(id: string, code: number) => void>();

export function onSessionExited(handler: (id: string, code: number) => void): () => void {
  exitHandlers.add(handler);
  return () => {
    exitHandlers.delete(handler);
  };
}

const noticeHandlers = new Set<(event: Extract<Event, { type: "notify" }>) => void>();

export function onNotice(handler: (event: Extract<Event, { type: "notify" }>) => void): () => void {
  noticeHandlers.add(handler);
  return () => {
    noticeHandlers.delete(handler);
  };
}

const viewHandlers = new Set<(event: Extract<Event, { type: "open_view" }>) => void>();

export function onOpenView(
  handler: (event: Extract<Event, { type: "open_view" }>) => void,
): () => void {
  viewHandlers.add(handler);
  return () => {
    viewHandlers.delete(handler);
  };
}

function applyEvent(event: Event): void {
  switch (event.type) {
    case "open_view":
      for (const handler of viewHandlers) {
        handler(event);
      }
      break;
    case "session_opened":
      sessions.value = upsert(sessions.value, event.session);
      break;
    case "session_state_changed":
      sessions.value = sessions.value.map((session) =>
        session.id === event.id ? { ...session, state: event.state } : session,
      );
      break;
    case "session_exited":
      sessions.value = sessions.value.map((session) =>
        session.id === event.id ? { ...session, exit_code: event.code, state: "done" } : session,
      );
      for (const handler of exitHandlers) {
        handler(event.id, event.code);
      }
      break;
    case "session_url":
      sessions.value = sessions.value.map((session) =>
        session.id === event.id ? { ...session, url: event.url } : session,
      );
      break;
    case "acp_updated":
      absorb(event.id, event.entry);
      break;
    case "acp_commands":
      offer(event.id, event.commands);
      break;
    case "session_closed":
      forgetSession(event.id);
      break;
    case "notify":
      for (const handler of noticeHandlers) {
        handler(event);
      }
      break;
    case "daemon_shutdown":
      sessions.value = [];
      break;
  }
}

function upsert(current: SessionSummary[], session: SessionSummary): SessionSummary[] {
  const index = current.findIndex((existing) => existing.id === session.id);
  if (index === -1) {
    return [...current, session];
  }
  const next = current.slice();
  next[index] = session;
  return next;
}

export function decodeUuid(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export async function createSession(
  project: string,
  agent: string,
  size: TerminalSize,
  isolation: Isolation = "directory",
  cwd: string | null = null,
  slug: string | null = null,
  mode: AgentMode | null = null,
): Promise<SessionSummary> {
  const session = await invoke<SessionSummary>("create_session", {
    project,
    agent,
    cwd,
    size,
    isolation,
    slug,
    mode,
  });
  sessions.value = upsert(sessions.value, session);
  return session;
}

export async function resumeSession(
  project: string,
  agent: string,
  sessionId: string,
  size: TerminalSize,
): Promise<SessionSummary> {
  const session = await invoke<SessionSummary>("resume_session", {
    project,
    agent,
    sessionId,
    size,
  });
  sessions.value = upsert(sessions.value, session);
  return session;
}

export async function attachSession(id: string): Promise<void> {
  await invoke("attach_session", { id });
}

export async function sendInput(id: string, data: string): Promise<void> {
  await invoke("send_input", { id, data });
}

export async function resizeSession(id: string, size: TerminalSize): Promise<void> {
  await invoke("resize_session", { id, size });
}

export async function closeSession(id: string, worktree: WorktreeDisposal = "keep"): Promise<void> {
  try {
    await invoke("close_session", { id, worktree });
  } catch (cause) {
    if (!alreadyGone(cause)) {
      complain(cause);
      throw cause;
    }
  } finally {
    forgetSession(id);
  }
}

function alreadyGone(cause: unknown): boolean {
  const said = cause instanceof Error ? cause.message : String(cause);
  return said.startsWith("NotFound:") && said.includes("does not exist");
}

export function forgetSession(id: string): void {
  sessions.value = sessions.value.filter((session) => session.id !== id);
  forget(id);
  disposeTerminal(id);
  listeners.delete(id);
  pendingOutput.delete(id);
  suspended.delete(id);
}

export function suspendTerminal(id: string): void {
  suspended.add(id);
  pendingOutput.delete(id);
}

export function resumeTerminal(id: string): void {
  suspended.delete(id);
}
