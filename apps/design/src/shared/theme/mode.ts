import { effect, signal } from "@preact/signals";

export type ThemeMode = "light" | "dark";
export type Palette = "current" | "proposal";
export type Veil = "off" | "on";

const KEY = "apex.design";

function restore<T extends string>(k: string, fallback: T): T {
  return (localStorage.getItem(`${KEY}.${k}`) as T | null) ?? fallback;
}

export const themeMode = signal<ThemeMode>(restore("theme", "dark"));
// Palette is fixed to "current" for now; revisit when we explore palettes.
export const palette = signal<Palette>("current");
export const veil = signal<Veil>(restore("veil", "off"));

effect(() => {
  localStorage.setItem(`${KEY}.theme`, themeMode.value);
  localStorage.setItem(`${KEY}.palette`, palette.value);
  localStorage.setItem(`${KEY}.veil`, veil.value);
});

/** Applies theme attributes to any element (document root or a wrapper). */
export function applyTheme(el: HTMLElement) {
  effect(() => {
    el.dataset.theme = themeMode.value;
    el.dataset.palette = palette.value === "proposal" ? "proposal" : "current";
    el.dataset.veil = veil.value;
    el.style.colorScheme = themeMode.value;
  });
}
