import { useEffect, useMemo, useState } from "preact/hooks";

import type { AgentSummary } from "../bindings/AgentSummary";
import type { SessionSummary } from "../bindings/SessionSummary";
import { t } from "../i18n";
import { createSession } from "../sessions";
import { findLeaf } from "./tree";
import {
  activeTab,
  closePane,
  closeTab,
  focusSession,
  openInNewTab,
  splitWithNewSession,
} from "./workspace";

type Action = {
  id: string;
  label: string;
  run: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  agents: AgentSummary[];
  sessions: SessionSummary[];
};

export function CommandPalette({ open, onClose, agents, sessions }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const actions = useMemo(
    () => buildActions(agents, sessions, onClose),
    [agents, sessions, onClose],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return actions;
    }
    return actions.filter((action) => action.label.toLowerCase().includes(needle));
  }, [actions, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(matches.length - 1, 0)));
  }, [matches.length]);

  if (!open) {
    return null;
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => (current + 1) % Math.max(matches.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => (current - 1 + matches.length) % Math.max(matches.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      matches[cursor]?.run();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onMouseDown={onClose}
    >
      <div
        class="w-[32rem] max-w-[90vw] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          type="text"
          autoFocus
          value={query}
          placeholder={t("palette.placeholder")}
          onInput={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          class="w-full border-b border-border bg-transparent px-3 py-2.5 outline-none placeholder:text-faint"
        />
        <ul class="max-h-80 overflow-y-auto py-1">
          {matches.length === 0 ? (
            <li class="px-3 py-2 text-faint">{t("palette.empty")}</li>
          ) : (
            matches.map((action, index) => (
              <li key={action.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={action.run}
                  class={`w-full px-3 py-1.5 text-left ${
                    index === cursor ? "bg-raised text-text" : "text-muted"
                  }`}
                >
                  {action.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function buildActions(
  agents: AgentSummary[],
  sessions: SessionSummary[],
  onClose: () => void,
): Action[] {
  const actions: Action[] = [];

  for (const agent of agents.filter((candidate) => candidate.resolved_path !== null)) {
    actions.push({
      id: `new:${agent.name}`,
      label: t("palette.newSession", { agent: agent.name }),
      run: () => {
        onClose();
        void createSession(agent.name, { rows: 24, cols: 80 }).then(openInNewTab);
      },
    });
  }

  for (const session of sessions) {
    actions.push({
      id: `goto:${session.id}`,
      label: t("palette.goTo", { title: session.title }),
      run: () => {
        onClose();
        if (!focusSession(session.id)) {
          openInNewTab(session);
        }
      },
    });
  }

  const tab = activeTab.value;
  if (tab) {
    const current = findLeaf(tab.root, tab.activeLeafId);
    const currentSession = sessions.find((session) => session.id === current?.sessionId);

    if (currentSession) {
      actions.push({
        id: "split:right",
        label: t("palette.splitRight"),
        run: () => {
          onClose();
          void splitWithNewSession(currentSession.agent, "row");
        },
      });
      actions.push({
        id: "split:down",
        label: t("palette.splitDown"),
        run: () => {
          onClose();
          void splitWithNewSession(currentSession.agent, "column");
        },
      });
    }

    if (current) {
      actions.push({
        id: "close:pane",
        label: t("palette.closePane"),
        run: () => {
          onClose();
          closePane(tab.id, current, true);
        },
      });
    }

    actions.push({
      id: "close:tab",
      label: t("palette.closeTab"),
      run: () => {
        onClose();
        closeTab(tab.id);
      },
    });
  }

  return actions;
}
