import { signal } from "@preact/signals";

export type Page = "workspace" | "settings";

export const page = signal<Page>("workspace");
export const settingsSection = signal("look");

export function openSettings(section = "look"): void {
  settingsSection.value = section;
  page.value = "settings";
}

export function closePage(): void {
  page.value = "workspace";
}

export function toggleSettings(section = "look"): void {
  if (page.value === "settings" && settingsSection.value === section) {
    page.value = "workspace";
    return;
  }
  openSettings(section);
}
