import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import { retheme } from "@/features/sessions/registry";

export type Veil = "solid" | "chrome" | "full";
export type Material = "subtle" | "medium" | "deep";
export type UiScale = "compact" | "normal" | "roomy";

const VEIL = "apex.veil";
const OPACITY = "apex.veil-opacity";
const MATERIAL = "apex.material";
const SCALE = "apex.ui-scale";

const VEILS: Veil[] = ["solid", "chrome", "full"];
const MATERIALS: Material[] = ["subtle", "medium", "deep"];
const SCALES: Record<UiScale, number> = { compact: 0.92, normal: 1, roomy: 1.14 };

export const MIN_OPACITY = 40;

function restore<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key) as T | null;
    return stored && allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function restoreOpacity(): number {
  const raw = Number.parseInt(localStorage.getItem(OPACITY) ?? "", 10);
  return Number.isFinite(raw) ? Math.min(100, Math.max(MIN_OPACITY, raw)) : 72;
}

export const veil = signal<Veil>(restore(VEIL, VEILS, "solid"));
export const veilOpacity = signal<number>(restoreOpacity());
export const material = signal<Material>(restore(MATERIAL, MATERIALS, "medium"));
export const uiScale = signal<UiScale>(restore(SCALE, Object.keys(SCALES) as UiScale[], "normal"));

export function setVeil(next: Veil): void {
  veil.value = next;
  localStorage.setItem(VEIL, next);
  applyAppearance();
}

export function setVeilOpacity(percent: number): void {
  veilOpacity.value = Math.min(100, Math.max(MIN_OPACITY, Math.round(percent)));
  localStorage.setItem(OPACITY, String(veilOpacity.value));
  applyAppearance();
}

export function setMaterial(next: Material): void {
  material.value = next;
  localStorage.setItem(MATERIAL, next);
  applyAppearance();
}

export function setUiScale(next: UiScale): void {
  uiScale.value = next;
  localStorage.setItem(SCALE, next);
  applyAppearance();
}

export function applyAppearance(): void {
  const root = document.documentElement;
  const translucent = veil.value !== "solid";

  if (translucent) {
    root.setAttribute("data-veil", veil.value);
  } else {
    root.removeAttribute("data-veil");
  }
  root.style.setProperty("--apex-veil", `${translucent ? veilOpacity.value : 100}%`);
  root.style.setProperty("--apex-scale", String(SCALES[uiScale.value]));

  void invoke("set_window_material", {
    material: translucent ? material.value : null,
  }).catch(() => {});

  retheme();
}
