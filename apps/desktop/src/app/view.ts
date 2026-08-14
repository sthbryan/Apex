import { signal } from "@preact/signals";

export type Page = "workspace" | "settings";

export const page = signal<Page>("workspace");

export function openPage(next: Page): void {
  page.value = next;
}

export function closePage(): void {
  page.value = "workspace";
}

export function togglePage(next: Page): void {
  page.value = page.value === next ? "workspace" : next;
}
