import { signal } from "@preact/signals";

export type DockPanel = "sessions" | "files" | "git" | "context" | "tasks";

export const DOCK_WIDTH_MIN = 192;
export const DOCK_WIDTH_MAX = 480;
export const DOCK_WIDTH_DEFAULT = 224;

const WIDTH_KEY = "apex.dockWidth";

export const dockOpen = signal(true);
export const dockHover = signal(false);
export const dockWidth = signal(readStoredWidth());
export const dockResizing = signal(false);
export const dockPanel = signal<DockPanel>("sessions");

applyDockWidth(dockWidth.value);

export function setDockHover(hovering: boolean): void {
  dockHover.value = hovering;
}

export function setDockPanel(panel: DockPanel): void {
  dockPanel.value = panel;
}

export function toggleDock(): void {
  dockHover.value = false;
  dockOpen.value = !dockOpen.value;
}

export function setDockWidth(px: number): void {
  const next = clampWidth(px);
  dockWidth.value = next;
  applyDockWidth(next);
  try {
    localStorage.setItem(WIDTH_KEY, String(next));
  } catch {}
}

export function resetDockWidth(): void {
  setDockWidth(DOCK_WIDTH_DEFAULT);
}

export function startDockWidth(): () => void {
  applyDockWidth(dockWidth.value);
  const onResize = () => setDockWidth(dockWidth.value);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}

function clampWidth(px: number): number {
  const room = typeof window === "undefined" ? DOCK_WIDTH_MAX : window.innerWidth - 280;
  return Math.round(Math.min(DOCK_WIDTH_MAX, room, Math.max(DOCK_WIDTH_MIN, px)));
}

function applyDockWidth(px: number): void {
  document.documentElement.style.setProperty("--apex-dock-width", `${px}px`);
}

function readStoredWidth(): number {
  try {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) {
      return clampWidth(stored);
    }
  } catch {}
  return DOCK_WIDTH_DEFAULT;
}
