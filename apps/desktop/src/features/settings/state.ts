import { signal } from "@preact/signals";

export const settingsOpen = signal(false);

export function toggleSettings(): void {
  settingsOpen.value = !settingsOpen.value;
}

export function closeSettings(): void {
  settingsOpen.value = false;
}
