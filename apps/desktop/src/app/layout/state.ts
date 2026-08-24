import { signal } from "@preact/signals";

export type DockPanel =
  | "sessions"
  | "files"
  | "git"
  | "review"
  | "race"
  | "history"
  | "context"
  | "tasks";
export type DockMode = "expanded" | "rail";

export const DOCK_WIDTH_MIN = 192;
export const DOCK_WIDTH_MAX = 480;
export const DOCK_WIDTH_DEFAULT = 224;

const WIDTH_KEY = "apex.dockWidth";
const MODE_KEY = "apex.dockMode";
const ORDER_KEY = "apex.dockOrder";

const ALL_PANELS: DockPanel[] = [
  "sessions",
  "files",
  "git",
  "review",
  "race",
  "history",
  "context",
  "tasks",
];

export const dockMode = signal<DockMode>(readStoredMode());
export const dockWidth = signal(readStoredWidth());
export const dockResizing = signal(false);
export const dockOrder = signal<DockPanel[]>(readStoredOrder());
export const dockPanel = signal<DockPanel>(dockOrder.value[0] ?? "sessions");

applyDockWidth(dockWidth.value);

export function setDockPanel(panel: DockPanel): void {
  if (dockOrder.value.includes(panel)) {
    dockPanel.value = panel;
  }
}

export function settleDockPanel(id: DockPanel, to: number): void {
  const order = [...dockOrder.value];
  const from = order.indexOf(id);
  if (from < 0 || to < 0 || to >= order.length || to === from) {
    return;
  }
  const [item] = order.splice(from, 1);
  order.splice(to, 0, item);
  dockOrder.value = order;
  persistOrder();
}

export function placePanelInDock(id: DockPanel, before?: DockPanel): void {
  const rest = dockOrder.value.filter((panel) => panel !== id);
  const at = before ? rest.indexOf(before) : rest.length;
  const index = at === -1 ? rest.length : at;
  dockOrder.value = [...rest.slice(0, index), id, ...rest.slice(index)];
  dockPanel.value = id;
  persistOrder();
}

export function removePanelFromDock(id: DockPanel): void {
  const next = dockOrder.value.filter((panel) => panel !== id);
  if (next.length === dockOrder.value.length) {
    return;
  }
  dockOrder.value = next;
  if (dockPanel.value === id) {
    dockPanel.value = next[0] ?? "sessions";
  }
  persistOrder();
}

export function returnPanelToDock(id: string): void {
  if (!isDockPanel(id) || dockOrder.value.includes(id)) {
    return;
  }
  placePanelInDock(id);
}

export function isDockPanel(id: string): id is DockPanel {
  return ALL_PANELS.includes(id as DockPanel);
}

export function reconcileDock(claimed: Iterable<string>): void {
  const taken = new Set(claimed);
  const docked = new Set(dockOrder.value);
  const missing = ALL_PANELS.filter((id) => !docked.has(id) && !taken.has(id));
  if (missing.length === 0) {
    return;
  }
  dockOrder.value = [...dockOrder.value, ...missing];
  persistOrder();
}

export function toggleDock(): void {
  setDockMode(dockMode.value === "expanded" ? "rail" : "expanded");
}

export function setDockMode(mode: DockMode): void {
  dockMode.value = mode;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
}

function readStoredMode(): DockMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "expanded" || stored === "rail") {
      return stored;
    }
  } catch {}
  return "expanded";
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

function persistOrder(): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(dockOrder.value));
  } catch {}
}

function readStoredOrder(): DockPanel[] {
  const known = new Set<string>(ALL_PANELS);
  try {
    const stored = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "null") as unknown;
    if (!Array.isArray(stored)) {
      return ALL_PANELS;
    }
    const kept = stored.filter((id): id is DockPanel => known.has(id));
    return kept.length > 0 ? kept : ALL_PANELS;
  } catch {
    return ALL_PANELS;
  }
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
