import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { ContextEntry } from "@/bindings/ContextEntry";
import { activeProjectId } from "@/features/projects/state";

export const entries = signal<ContextEntry[]>([]);
export const failure = signal<string | null>(null);

export async function loadContext(): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    entries.value = [];
    return;
  }
  try {
    entries.value = await invoke<ContextEntry[]>("context_list", { project });
    failure.value = null;
  } catch (error) {
    entries.value = [];
    failure.value = String(error);
  }
}

export async function readEntry(key: string): Promise<string> {
  return invoke<string>("context_read", { project: activeProjectId.value, key });
}

export async function writeEntry(key: string, contents: string): Promise<void> {
  await invoke("context_write", { project: activeProjectId.value, key, contents });
  await loadContext();
}
