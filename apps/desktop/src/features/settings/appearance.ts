import { signal } from "@preact/signals";

import { retheme } from "@/features/sessions/registry";

export type UiScale = "compact" | "normal" | "roomy";

const SCALE = "apex.ui-scale";
const SCALES: Record<UiScale, number> = { compact: 0.92, normal: 1, roomy: 1.14 };

function restoreScale(): UiScale {
  try {
    const stored = localStorage.getItem(SCALE) as UiScale | null;
    return stored && stored in SCALES ? stored : "normal";
  } catch {
    return "normal";
  }
}

export const uiScale = signal<UiScale>(restoreScale());

export function setUiScale(next: UiScale): void {
  uiScale.value = next;
  localStorage.setItem(SCALE, next);
  applyAppearance();
}

export function applyAppearance(): void {
  document.documentElement.style.setProperty("--apex-scale", String(SCALES[uiScale.value]));
  retheme();
}
