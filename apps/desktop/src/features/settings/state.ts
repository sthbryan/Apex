import { signal } from "@preact/signals";

export const dockOpen = signal(true);
export const dockHover = signal(false);

export function setDockHover(hovering: boolean): void {
  dockHover.value = hovering;
}

export function toggleDock(): void {
  dockHover.value = false;
  dockOpen.value = !dockOpen.value;
}
