import { useEffect } from "preact/hooks";
import { toggleDock } from "@/app/layout/state";
import { togglePage } from "@/app/view";
import { splitWithShell } from "@/features/sessions/pending";
import { toggleUsagePopover } from "@/features/usage/state";
import { activeTab, activeTabId, closePane, tabs } from "@/features/workspace/state";
import { findLeaf } from "@/features/workspace/tree";

type Toggles = {
  togglePalette: () => void;
  toggleFinder: () => void;
};

export function useKeymap({ togglePalette, toggleFinder }: Toggles): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      const binding = BINDINGS[event.key.toLowerCase()];
      if (binding) {
        event.preventDefault();
        binding({ event, togglePalette, toggleFinder });
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

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [togglePalette, toggleFinder]);
}

type Context = Toggles & { event: KeyboardEvent };

const BINDINGS: Record<string, (context: Context) => void> = {
  k: ({ togglePalette }) => togglePalette(),
  p: ({ toggleFinder }) => toggleFinder(),
  ",": () => togglePage("settings"),
  u: () => toggleUsagePopover(),
  b: () => toggleDock(),
  d: ({ event }) => {
    void splitWithShell(event.shiftKey ? "column" : "row");
  },
  w: () => {
    const tab = activeTab.value;
    const pane = currentPane();
    if (tab && pane) {
      closePane(tab.id, pane, true);
    }
  },
};

function currentPane() {
  const tab = activeTab.value;
  return tab ? findLeaf(tab.root, tab.activeLeafId) : null;
}
