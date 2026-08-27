import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { AgentSummary } from "@/bindings/AgentSummary";
import { startSessionBridge } from "@/features/sessions/state";

export type ConnectionStatus = "connecting" | "ready" | "failed";

export const status = signal<ConnectionStatus>("connecting");
export const failure = signal<string | null>(null);
export const agents = signal<AgentSummary[]>([]);

export function isInstalled(agent: AgentSummary): boolean {
  return agent.resolved_path !== null;
}

export const installedAgents = computed(() => agents.value.filter(isInstalled));
export const daemonVersion = signal<string | null>(null);
export type Notice = { id: number; text: string };

export const notices = signal<Notice[]>([]);

const NOTICE_LIFETIME = 6000;
let nextNotice = 0;

const CODES = [
  "UnsupportedVersion",
  "Unauthorized",
  "MalformedRequest",
  "NotFound",
  "Conflict",
  "Internal",
];

export function spell(cause: unknown): string {
  const text = cause instanceof Error ? cause.message : String(cause);
  const at = text.indexOf(": ");
  return at > 0 && CODES.includes(text.slice(0, at)) ? text.slice(at + 2) : text;
}

export function complain(cause: unknown): void {
  const id = ++nextNotice;
  notices.value = [...notices.value.slice(-3), { id, text: spell(cause) }];
  setTimeout(() => hush(id), NOTICE_LIFETIME);
}

export function stopDaemon(): void {
  invoke("stop_daemon");
}

export function hush(id: number): void {
  notices.value = notices.value.filter((notice) => notice.id !== id);
}

export const stale = computed(() => (failure.value ?? "").includes("UnsupportedVersion"));
export const platform = signal<string | null>(null);

export async function connect(): Promise<void> {
  status.value = "connecting";
  failure.value = null;
  try {
    platform.value = await invoke<string>("host_platform");
    daemonVersion.value = await invoke<string>("daemon_version");
    agents.value = await invoke<AgentSummary[]>("list_agents");
    await startSessionBridge();
    status.value = "ready";
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause);
    status.value = "failed";
  }
}
