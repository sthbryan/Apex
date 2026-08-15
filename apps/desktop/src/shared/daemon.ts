import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { AgentSummary } from "@/bindings/AgentSummary";
import { startSessionBridge } from "@/features/sessions/state";

export type ConnectionStatus = "connecting" | "ready" | "failed";

export const status = signal<ConnectionStatus>("connecting");
export const failure = signal<string | null>(null);
export const agents = signal<AgentSummary[]>([]);
export const daemonVersion = signal<string | null>(null);
export const notice = signal<string | null>(null);

export function complain(cause: unknown): void {
  notice.value = cause instanceof Error ? cause.message : String(cause);
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
