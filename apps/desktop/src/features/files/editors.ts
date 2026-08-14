import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { EditorSummary } from "@/bindings/EditorSummary";

const STORAGE_KEY = "apex.editor";

export const editors = signal<EditorSummary[]>([]);
export const preferredEditor = signal<string | null>(readStored());

export const installedEditors = () => editors.value.filter((entry) => entry.resolved_path !== null);

export async function loadEditors(): Promise<void> {
  editors.value = await invoke<EditorSummary[]>("list_editors").catch(() => []);
  if (preferredEditor.value && !editors.value.some((entry) => entry.id === preferredEditor.value)) {
    setPreferredEditor(null);
  }
}

export function setPreferredEditor(id: string | null): void {
  preferredEditor.value = id;
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export async function openExternally(project: string, path: string): Promise<void> {
  await invoke("open_externally", { project, path, editor: preferredEditor.value });
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
