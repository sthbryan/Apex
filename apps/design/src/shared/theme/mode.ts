import { effect, signal } from "@preact/signals";

export type ThemeMode = "light" | "dark";
export type Veil = "off" | "on";

const KEY = "apex.design";

function restore<T extends string>(k: string, fallback: T): T {
  return (localStorage.getItem(`${KEY}.${k}`) as T | null) ?? fallback;
}

export const themeMode = signal<ThemeMode>(restore("theme", "dark"));
export const veil = signal<Veil>(restore("veil", "off"));

effect(() => {
  localStorage.setItem(`${KEY}.theme`, themeMode.value);
  localStorage.setItem(`${KEY}.veil`, veil.value);
});

export function applyTheme(el: HTMLElement) {
  effect(() => {
    el.dataset.theme = themeMode.value;
    el.dataset.veil = veil.value;
    el.style.colorScheme = themeMode.value;
  });
}
