import { toggleDock } from "@/app/layout/state";
import { togglePage } from "@/app/view";
import { cycleLayout, splitWithShell } from "@/features/sessions/pending";
import { toggleUsagePopover } from "@/features/usage/state";
import { activeTab, closePane } from "@/features/workspace/state";
import { type Direction, findLeaf } from "@/features/workspace/tree";

export type Toggles = {
  togglePalette: () => void;
  toggleFinder: () => void;
};

let toggles: Toggles = { togglePalette: () => {}, toggleFinder: () => {} };

export function useToggles(next: Toggles): void {
  toggles = next;
}

export const COMMANDS: Record<string, () => void> = {
  palette: () => toggles.togglePalette(),
  finder: () => toggles.toggleFinder(),
  settings: () => togglePage("settings"),
  shortcuts: () => togglePage("shortcuts"),
  usage: () => toggleUsagePopover(),
  dock: () => toggleDock(),
  "split-right": () => split("row"),
  "split-down": () => split("column"),
  "cycle-layout": () => cycleLayout(),
  "close-pane": () => closeCurrentPane(),
};

export function run(id: string): void {
  COMMANDS[id]?.();
}

function split(direction: Direction): void {
  void splitWithShell(direction);
}

function closeCurrentPane(): void {
  const tab = activeTab.value;
  const pane = tab ? findLeaf(tab.root, tab.activeLeafId) : null;
  if (tab && pane) {
    closePane(tab.id, pane, true);
  }
}
