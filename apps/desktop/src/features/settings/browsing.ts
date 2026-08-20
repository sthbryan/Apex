import { signal } from "@preact/signals";

export type Browsing = "internal" | "system";

const KEY = "apex.browsing";

function restore(): Browsing {
  try {
    return localStorage.getItem(KEY) === "system" ? "system" : "internal";
  } catch {
    return "internal";
  }
}

export const browsing = signal<Browsing>(restore());

export function setBrowsing(next: Browsing): void {
  browsing.value = next;
  localStorage.setItem(KEY, next);
}
