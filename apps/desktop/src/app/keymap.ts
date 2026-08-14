import { useEffect } from "preact/hooks";

import { sessions } from "@/features/sessions/state";
import { toggleSettings } from "@/features/settings/Settings";
import { toggleUsagePopover } from "@/features/usage/state";
import {
  activeTab,
  activeTabId,
  closePane,
  splitWithNewSession,
  tabs,
} from "@/features/workspace/state";
import { findLeaf } from "@/features/workspace/tree";

type Toggles = {
  togglePalette: () => void;
  toggleDock: () => void;
};

export function useKeymap({ togglePalette, toggleDock }: Toggles): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      const binding = BINDINGS[event.key.toLowerCase()];
      if (binding) {
        event.preventDefault();
        binding({ event, togglePalette, toggleDock });
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
  }, [togglePalette, toggleDock]);
}

type Context = Toggles & { event: KeyboardEvent };

const BINDINGS: Record<string, (context: Context) => void> = {
  k: ({ togglePalette }) => togglePalette(),
  ",": () => toggleSettings(),
  u: () => toggleUsagePopover(),
  b: ({ toggleDock }) => toggleDock(),
  d: ({ event }) => {
    const pane = currentPane();
    const session = sessions.value.find((candidate) => candidate.id === pane?.sessionId);
    if (session) {
      void splitWithNewSession(
        session.project_id,
        session.agent,
        event.shiftKey ? "column" : "row",
      );
    }
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
