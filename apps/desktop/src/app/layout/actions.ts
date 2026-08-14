import {
  type DockPanel,
  dockOrder,
  placePanelInDock,
  removePanelFromDock,
  setDockPanel,
} from "@/app/layout/state";
import { closePanelViews, openPanel } from "@/features/workspace/state";

export function revealPanel(id: DockPanel): void {
  if (dockOrder.value.includes(id)) {
    setDockPanel(id);
    return;
  }
  openPanel(id);
}

export function popPanelToTab(id: DockPanel): void {
  removePanelFromDock(id);
  openPanel(id);
}

export function dockPanelAt(id: DockPanel, before?: DockPanel): void {
  placePanelInDock(id, before);
  closePanelViews(id);
}
