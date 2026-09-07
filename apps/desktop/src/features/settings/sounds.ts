import { signal } from "@preact/signals";
import { bind, play, setEnabled, setVolume } from "cuelume";

const STORAGE_KEY = "apex.interaction-sounds";
const SLIDER_INTERVAL = 90;
const SEARCH_INTERVAL = 45;
const wiredSearchRoots = new WeakSet<EventTarget>();

function restoreEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export const interactionSoundsEnabled = signal(restoreEnabled());

setVolume(0.22);
setEnabled(interactionSoundsEnabled.value);

export function setInteractionSoundsEnabled(enabled: boolean): void {
  interactionSoundsEnabled.value = enabled;
  setEnabled(enabled);
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {}
}

export function startSettingsSounds(root: HTMLElement): void {
  bind(root);
  if (!wiredSearchRoots.has(root)) {
    wiredSearchRoots.add(root);
    root.addEventListener("input", playSearchCue);
  }
  play("bloom", { volume: 0.7 });
}

let lastSliderCue = Number.NEGATIVE_INFINITY;
let lastSearchCue = Number.NEGATIVE_INFINITY;

function playSearchCue(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.matches(".ui-settings-search input, .ui-select-search")) return;

  const now = performance.now();
  if (now - lastSearchCue < SEARCH_INTERVAL) return;
  lastSearchCue = now;
  play("tick", { volume: 0.35 });
}

export function playSliderCue(): void {
  const now = performance.now();
  if (now - lastSliderCue < SLIDER_INTERVAL) return;
  lastSliderCue = now;
  play("tick", { volume: 0.45 });
}
