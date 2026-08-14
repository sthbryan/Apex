import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";

export const PANEL_MIME = "application/x-apex-panel";
const PANEL_PREFIX = "apex-panel:";

export function writePanelDrag(event: DragEvent, id: DockPanel): void {
  if (!event.dataTransfer) {
    return;
  }
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(PANEL_MIME, id);
  event.dataTransfer.setData("text/plain", `${PANEL_PREFIX}${id}`);
}

export function hasPanelDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) {
    return false;
  }
  return types.includes(PANEL_MIME) || types.includes("text/plain");
}

export function readPanelDrag(event: DragEvent): DockPanel | null {
  const raw = event.dataTransfer?.getData(PANEL_MIME) || event.dataTransfer?.getData("text/plain");
  if (!raw) {
    return null;
  }
  const id = raw.startsWith(PANEL_PREFIX) ? raw.slice(PANEL_PREFIX.length) : raw;
  return id in DOCK_PANELS ? (id as DockPanel) : null;
}
