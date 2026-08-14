import { signal } from "@preact/signals";

import { retheme } from "@/features/sessions/registry";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "apex.theme";
const ORDER: ThemeMode[] = ["system", "light", "dark"];

export const themeMode = signal<ThemeMode>(readStored());

export function setThemeMode(mode: ThemeMode): void {
  themeMode.value = mode;
  applyThemeMode(mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

export function cycleThemeMode(): void {
  const next = ORDER[(ORDER.indexOf(themeMode.value) + 1) % ORDER.length];
  setThemeMode(next);
}

export function startThemeWatcher(): () => void {
  applyThemeMode(themeMode.value);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (themeMode.value === "system") {
      retheme();
    }
  };
  media.addEventListener("change", onSystemChange);
  return () => media.removeEventListener("change", onSystemChange);
}

function applyThemeMode(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", mode);
  }
  retheme();
}

function readStored(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return ORDER.includes(stored as ThemeMode) ? (stored as ThemeMode) : "system";
  } catch {
    return "system";
  }
}
