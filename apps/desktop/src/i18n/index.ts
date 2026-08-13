import { computed, signal } from "@preact/signals";

import { en, type MessageKey, type Messages } from "./en";
import { es } from "./es";

export type Locale = "en" | "es";
export type { MessageKey };

const CATALOGS: Record<Locale, Messages> = { en, es };
const STORAGE_KEY = "apex.locale";

export const locale = signal<Locale>(detectLocale());

const catalog = computed(() => CATALOGS[locale.value]);

export function setLocale(next: Locale): void {
  locale.value = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // el almacenamiento puede estar bloqueado; la eleccion vive en memoria
  }
}

export function t(key: MessageKey, params?: Record<string, string>): string {
  const template = catalog.value[key];
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}

function detectLocale(): Locale {
  const stored = readStoredLocale();
  if (stored) {
    return stored;
  }
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "es" ? stored : null;
  } catch {
    return null;
  }
}
