import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import { retheme } from "@/features/sessions/registry";
import { complain, platform } from "@/shared/daemon";

export type UiScale = "compact" | "normal" | "roomy";
export type Frost = "soft" | "glare" | "bright" | "deep";
export type VeilArea = "window" | "sidebar";

const SCALE = "apex.ui-scale";
const TRANSLUCENT = "apex.translucent";
const OPACITY = "apex.veil-opacity";
const FROST = "apex.frost";
const LEGACY_BLUR = "apex.blur";
const AREA = "apex.veil-area";

const SCALES: Record<UiScale, number> = { compact: 0.92, normal: 1, roomy: 1.14 };

export const MIN_OPACITY = 50;

const FROSTS: Frost[] = ["soft", "glare", "bright", "deep"];

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function restoreNumber(key: string, fallback: number, low: number, high: number): number {
  const raw = Number.parseInt(localStorage.getItem(key) ?? "", 10);
  return Number.isFinite(raw) ? clamp(raw, low, high) : fallback;
}

function restoreFrost(): Frost {
  const stored = localStorage.getItem(FROST) as Frost | null;
  if (stored && FROSTS.includes(stored)) {
    return stored;
  }
  const legacy = Number.parseInt(localStorage.getItem(LEGACY_BLUR) ?? "", 10);
  return FROSTS[legacy - 1] ?? "bright";
}

function restoreArea(): VeilArea {
  return localStorage.getItem(AREA) === "sidebar" ? "sidebar" : "window";
}

function restoreScale(): UiScale {
  try {
    const stored = localStorage.getItem(SCALE) as UiScale | null;
    return stored && stored in SCALES ? stored : "normal";
  } catch {
    return "normal";
  }
}

// TODO: Missing testing on Windows and Linux for translucency support
export const translucencySupported = computed(() => platform.value === "macos");

export const uiScale = signal<UiScale>(restoreScale());
export const translucent = signal<boolean>(localStorage.getItem(TRANSLUCENT) === "on");
export const veilOpacity = signal<number>(restoreNumber(OPACITY, 72, MIN_OPACITY, 100));
export const frost = signal<Frost>(restoreFrost());
export const veilArea = signal<VeilArea>(restoreArea());

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

export function setVeilArea(next: VeilArea): void {
  veilArea.value = next;
  localStorage.setItem(AREA, next);
  applyAppearance();
}

export function setFrost(next: Frost): void {
  frost.value = next;
  localStorage.setItem(FROST, next);
  localStorage.removeItem(LEGACY_BLUR);
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
  if (on) {
    root.style.setProperty("--apex-veil-tint", `${veilOpacity.value}%`);
    root.setAttribute("data-veil-area", veilArea.value);
  } else {
    root.style.removeProperty("--apex-veil-tint");
    root.removeAttribute("data-veil-area");
  }
  root.style.setProperty("--apex-scale", String(SCALES[uiScale.value]));

  void invoke("set_window_material", { frost: on ? frost.value : "none" }).catch(complain);

  retheme();
}
