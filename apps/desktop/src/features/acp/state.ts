import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { AcpCommand } from "@/bindings/AcpCommand";
import type { AcpEntry } from "@/bindings/AcpEntry";
import type { AcpPermission } from "@/bindings/AcpPermission";
import type { AcpPicker } from "@/bindings/AcpPicker";
import type { AcpSnapshot } from "@/bindings/AcpSnapshot";

export const transcripts = signal<Record<string, AcpEntry[]>>({});
export const commands = signal<Record<string, AcpCommand[]>>({});
export const models = signal<Record<string, AcpPicker>>({});
export const modes = signal<Record<string, AcpPicker>>({});
export const failure = signal<string | null>(null);
export const queued = signal<Record<string, string[]>>({});

export type Shown =
  | { kind: "entry"; at: number; entry: AcpEntry }
  | { kind: "ask"; at: number; asks: AcpPermission[] };

export function laidOut(entries: AcpEntry[]): Shown[] {
  const shown: Shown[] = [];
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    if (entry.body.type !== "permission") {
      shown.push({ kind: "entry", at: entry.index, entry });
      continue;
    }
    const ask = entry.body.ask;
    const last = shown[shown.length - 1];
    if (last?.kind === "ask" && ask.group !== null && last.asks[0].group === ask.group) {
      last.asks = [...last.asks, ask].sort((one, two) => one.at - two.at);
      continue;
    }
    shown.push({ kind: "ask", at: entry.index, asks: [ask] });
  }
  return shown;
}

export function entriesOf(id: string): AcpEntry[] {
  return transcripts.value[id] ?? [];
}

export function absorb(id: string, entry: AcpEntry): void {
  const current = entriesOf(id);
  const next = current.slice();
  const missing = entry.index > next.length;
  for (let slot = next.length; slot < entry.index; slot += 1) {
    next[slot] = { index: slot, at: 0, body: { type: "notice", text: "…" } };
  }
  next[entry.index] = entry;
  transcripts.value = { ...transcripts.value, [id]: next };
  if (missing) {
    void loadTranscript(id);
  }
}

export function offer(id: string, offered: AcpCommand[]): void {
  commands.value = { ...commands.value, [id]: offered };
}

export function forget(id: string): void {
  const { [id]: gone, ...rest } = transcripts.value;
  if (gone) {
    transcripts.value = rest;
  }
  const { [id]: dropped, ...others } = commands.value;
  if (dropped) {
    commands.value = others;
  }
  const { [id]: waiting, ...left } = queued.value;
  if (waiting) {
    queued.value = left;
  }
}

export function queuedIn(id: string): string[] {
  return queued.value[id] ?? [];
}

export function queue(id: string, text: string): void {
  queued.value = { ...queued.value, [id]: [...queuedIn(id), text] };
}

export function unqueue(id: string, at: number): void {
  queued.value = { ...queued.value, [id]: queuedIn(id).filter((_, slot) => slot !== at) };
}

export async function drain(id: string): Promise<void> {
  const waiting = queuedIn(id);
  const [next, ...rest] = waiting;
  if (next === undefined) {
    return;
  }
  queued.value = { ...queued.value, [id]: rest };
  await prompt(id, next);
}

export async function loadTranscript(id: string): Promise<void> {
  try {
    const snapshot = await invoke<AcpSnapshot>("acp_transcript", { id });
    transcripts.value = { ...transcripts.value, [id]: snapshot.entries };
    commands.value = { ...commands.value, [id]: snapshot.commands };
    models.value = { ...models.value, [id]: snapshot.models };
    modes.value = { ...modes.value, [id]: snapshot.modes };
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

export async function choose(id: string, model: string | null, mode: string | null): Promise<void> {
  const picker = model ? models : modes;
  const chosen = model ?? mode;
  const before = picker.value[id];
  if (before) {
    picker.value = { ...picker.value, [id]: { ...before, chosen } };
  }
  try {
    await invoke("acp_choose", { id, model, mode });
    failure.value = null;
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause);
    if (before) {
      picker.value = { ...picker.value, [id]: before };
    }
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
