import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { AgentSummary } from "@/bindings/AgentSummary";
import { startSessionBridge } from "@/features/sessions/state";

export type ConnectionStatus = "connecting" | "ready" | "failed";

export const status = signal<ConnectionStatus>("connecting");
export const failure = signal<string | null>(null);
export const agents = signal<AgentSummary[]>([]);
export const daemonVersion = signal<string | null>(null);
export type Notice = { id: number; text: string };

export const notices = signal<Notice[]>([]);

const NOTICE_LIFETIME = 6000;
let nextNotice = 0;

export function complain(cause: unknown): void {
  const text = cause instanceof Error ? cause.message : String(cause);
  const id = ++nextNotice;
  notices.value = [...notices.value.slice(-3), { id, text }];
  setTimeout(() => hush(id), NOTICE_LIFETIME);
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
