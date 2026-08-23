import { useEffect } from "preact/hooks";
import { COMMANDS, type Toggles, useToggles } from "@/app/commands";
import { splitWithShell } from "@/features/sessions/pending";
import { activeTabId, tabs } from "@/features/workspace/state";
import type { Direction } from "@/features/workspace/tree";
import type { MessageKey } from "@/shared/i18n";

const ARROW_DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: "row-reverse",
  ArrowRight: "row",
  ArrowUp: "column-reverse",
  ArrowDown: "column",
};

let pendingDirection: Direction | null = null;

export function useKeymap(toggles: Toggles): void {
  useToggles(toggles);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      const direction = ARROW_DIRECTIONS[event.key];
      if (direction) {
        pendingDirection = direction;
        return;
      }
      const binding = BINDINGS[event.key.toLowerCase()];
      if (binding) {
        event.preventDefault();
        binding(event);
        return;
      }

      const index = Number.parseInt(event.key, 10);
      if (Number.isInteger(index) && index >= 1 && index <= 9) {
        const target = tabs.value[index - 1];
        if (target) {
          event.preventDefault();
          activeTabId.value = target.id;
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (ARROW_DIRECTIONS[event.key]) {
        pendingDirection = null;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [toggles.togglePalette, toggles.toggleFinder]);
}

const BINDINGS: Record<string, (event: KeyboardEvent) => void> = {
  k: () => COMMANDS.palette(),
  p: () => COMMANDS.finder(),
  ",": () => COMMANDS.settings(),
  h: () => COMMANDS.shortcuts(),
  u: () => COMMANDS.usage(),
  b: () => COMMANDS.dock(),
  d: (event) => {
    const direction = pendingDirection ?? (event.shiftKey ? "column" : "row");
    pendingDirection = null;
    void splitWithShell(direction);
  },
  l: (event) => {
    if (event.shiftKey) {
      COMMANDS["cycle-layout"]();
    }
  },
  w: () => COMMANDS["close-pane"](),
};

export type Shortcut = {
  id: string;
  keys: string[];
  label: MessageKey;
  group: "navigation" | "panes";
};

export const SHORTCUTS: Shortcut[] = [
  { id: "palette", keys: ["⌘", "K"], label: "shortcuts.palette", group: "navigation" },
  { id: "finder", keys: ["⌘", "P"], label: "shortcuts.finder", group: "navigation" },
  { id: "shortcuts", keys: ["⌘", "H"], label: "shortcuts.shortcuts", group: "navigation" },
  { id: "settings", keys: ["⌘", ","], label: "shortcuts.settings", group: "navigation" },
  { id: "usage", keys: ["⌘", "U"], label: "shortcuts.usage", group: "navigation" },
  { id: "dock", keys: ["⌘", "B"], label: "shortcuts.dock", group: "navigation" },
  { id: "tab-1-9", keys: ["⌘", "1…9"], label: "shortcuts.tabs", group: "navigation" },
  { id: "split-right", keys: ["⌘", "D"], label: "shortcuts.splitRight", group: "panes" },
  {
    id: "split-direction",
    keys: ["⌘", "← → ↑ ↓", "D"],
    label: "shortcuts.splitDirection",
    group: "panes",
  },
  { id: "split-down", keys: ["⌘", "⇧", "D"], label: "shortcuts.splitDown", group: "panes" },
  { id: "cycle-layout", keys: ["⌘", "⇧", "L"], label: "shortcuts.cycleLayout", group: "panes" },
  { id: "close-pane", keys: ["⌘", "W"], label: "shortcuts.closePane", group: "panes" },
];
