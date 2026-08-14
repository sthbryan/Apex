import { signal } from "@preact/signals";

export const dockOpen = signal(true);

export function toggleDock(): void {
  dockOpen.value = !dockOpen.value;
}

export const settingsOpen = signal(false);

export function toggleSettings(): void {
  settingsOpen.value = !settingsOpen.value;
}

export function closeSettings(): void {
  settingsOpen.value = false;
}
