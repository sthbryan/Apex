import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { AcpEntry } from "@/bindings/AcpEntry";

export const transcripts = signal<Record<string, AcpEntry[]>>({});
export const failure = signal<string | null>(null);

export function entriesOf(id: string): AcpEntry[] {
  return transcripts.value[id] ?? [];
}

export function absorb(id: string, entry: AcpEntry): void {
  const current = entriesOf(id);
  const next = current.slice();
  next[entry.index] = entry;
  transcripts.value = { ...transcripts.value, [id]: next };
}

export function forget(id: string): void {
  const { [id]: gone, ...rest } = transcripts.value;
  if (gone) {
    transcripts.value = rest;
  }
}

export async function loadTranscript(id: string): Promise<void> {
  try {
    const entries = await invoke<AcpEntry[]>("acp_transcript", { id });
    transcripts.value = { ...transcripts.value, [id]: entries };
    failure.value = null;
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause);
  }
}

export async function prompt(id: string, text: string): Promise<void> {
  try {
    await invoke("acp_prompt", { id, text });
    failure.value = null;
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause);
  }
}

export async function cancel(id: string): Promise<void> {
  try {
    await invoke("acp_cancel", { id });
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause);
  }
}

export async function decide(id: string, request: number, option: string | null): Promise<void> {
  try {
    await invoke("acp_decide", { id, request, option });
    failure.value = null;
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause);
  }
}
