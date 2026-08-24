import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

export type Closing = "quit" | "tray";

const KEY = "apex.closing";

function restore(): Closing {
  try {
    return localStorage.getItem(KEY) === "tray" ? "tray" : "quit";
  } catch {
    return "quit";
  }
}

export const closing = signal<Closing>(restore());

export function setClosing(next: Closing): void {
  closing.value = next;
  localStorage.setItem(KEY, next);
  applyClosing();
}

export function applyClosing(): void {
  invoke("set_keep_alive", { keep: closing.value === "tray" });
}
