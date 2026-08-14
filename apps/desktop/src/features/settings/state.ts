import { signal } from "@preact/signals";

export type DockMode = "pinned" | "floating";

const DOCK_KEY = "apex.dock";

export const dockMode = signal<DockMode>(readDockMode());
export const dockOpen = signal(dockMode.value === "pinned");

export function setDockMode(mode: DockMode): void {
  dockMode.value = mode;
  dockOpen.value = mode === "pinned";
  try {
    localStorage.setItem(DOCK_KEY, mode);
  } catch {}
}

export function toggleDock(): void {
  dockOpen.value = !dockOpen.value;
}

function readDockMode(): DockMode {
  try {
    return localStorage.getItem(DOCK_KEY) === "floating" ? "floating" : "pinned";
  } catch {
    return "pinned";
  }
}

export const settingsOpen = signal(false);

export function toggleSettings(): void {
  settingsOpen.value = !settingsOpen.value;
}

export function closeSettings(): void {
  settingsOpen.value = false;
}
