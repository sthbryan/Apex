import { computed, signal } from "@preact/signals";

import { en, type MessageKey, type Messages } from "@/shared/i18n/en";
import { es } from "@/shared/i18n/es";

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
  } catch {}
}

function lookup(tree: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let node: unknown = tree;
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function t(key: MessageKey, params?: Record<string, string>): string {
  const template = lookup(catalog.value, key) ?? lookup(en, key) ?? key;
  if (!params) return template;
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
