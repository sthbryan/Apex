import { signal } from "@preact/signals";

export const dockOpen = signal(true);

export function toggleDock(): void {
  dockOpen.value = !dockOpen.value;
}
