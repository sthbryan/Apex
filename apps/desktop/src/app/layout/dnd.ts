import type { DockPanel } from "@/app/layout/state";

export const PANEL_MIME = "application/x-apex-panel";
const PANEL_PREFIX = "apex-panel:";

let dragging: DockPanel | null = null;

export function writePanelDrag(event: DragEvent, id: DockPanel): void {
  dragging = id;
  const data = event.dataTransfer;
  if (data) {
    data.effectAllowed = "move";
    data.setData(PANEL_MIME, id);
    data.setData("text/plain", `${PANEL_PREFIX}${id}`);
  }
}

export function clearPanelDrag(): void {
  dragging = null;
}

export function hasPanelDrag(): boolean {
  return dragging !== null;
}

export function readPanelDrag(): DockPanel | null {
  return dragging;
}
