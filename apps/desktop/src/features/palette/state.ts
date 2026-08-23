import { signal } from "@preact/signals";

export const paletteOpen = signal(false);
export const finderOpen = signal(false);

export function togglePalette(): void {
  paletteOpen.value = !paletteOpen.value;
}

export function toggleFinder(): void {
  finderOpen.value = !finderOpen.value;
}
