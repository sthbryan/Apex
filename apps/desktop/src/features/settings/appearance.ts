import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import { retheme } from "@/features/sessions/registry";
import { complain } from "@/shared/daemon";

export type UiScale = "compact" | "normal" | "roomy";

const SCALE = "apex.ui-scale";
const TRANSLUCENT = "apex.translucent";
const OPACITY = "apex.veil-opacity";
const BLUR = "apex.blur";

const SCALES: Record<UiScale, number> = { compact: 0.92, normal: 1, roomy: 1.14 };

export const MIN_OPACITY = 50;
export const MIN_BLUR = 1;
export const MAX_BLUR = 4;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function restoreNumber(key: string, fallback: number, low: number, high: number): number {
  const raw = Number.parseInt(localStorage.getItem(key) ?? "", 10);
  return Number.isFinite(raw) ? clamp(raw, low, high) : fallback;
}

function restoreScale(): UiScale {
  try {
    const stored = localStorage.getItem(SCALE) as UiScale | null;
    return stored && stored in SCALES ? stored : "normal";
  } catch {
    return "normal";
  }
}

export const uiScale = signal<UiScale>(restoreScale());
export const translucent = signal<boolean>(localStorage.getItem(TRANSLUCENT) === "on");
export const veilOpacity = signal<number>(restoreNumber(OPACITY, 85, MIN_OPACITY, 100));
export const blur = signal<number>(restoreNumber(BLUR, 2, MIN_BLUR, MAX_BLUR));

export function setUiScale(next: UiScale): void {
  uiScale.value = next;
  localStorage.setItem(SCALE, next);
  applyAppearance();
}

export function setTranslucent(on: boolean): void {
  translucent.value = on;
  localStorage.setItem(TRANSLUCENT, on ? "on" : "off");
  applyAppearance();
}

export function setVeilOpacity(percent: number): void {
  veilOpacity.value = clamp(Math.round(percent), MIN_OPACITY, 100);
  localStorage.setItem(OPACITY, String(veilOpacity.value));
  applyAppearance();
}

export function setBlur(level: number): void {
  blur.value = clamp(Math.round(level), MIN_BLUR, MAX_BLUR);
  localStorage.setItem(BLUR, String(blur.value));
  applyAppearance();
}

export function applyAppearance(): void {
  const root = document.documentElement;
  const on = translucent.value;

  if (on) {
    root.setAttribute("data-veil", "on");
  } else {
    root.removeAttribute("data-veil");
  }
  root.style.setProperty("--apex-veil", `${on ? veilOpacity.value : 100}%`);
  root.style.setProperty("--apex-scale", String(SCALES[uiScale.value]));

  void invoke("set_window_material", { blur: on ? blur.value : 0 }).catch(complain);

  retheme();
}
