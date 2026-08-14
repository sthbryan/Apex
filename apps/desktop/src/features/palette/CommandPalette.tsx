import { useEffect, useMemo, useState } from "preact/hooks";
import type { AgentSummary } from "@/bindings/AgentSummary";
import type { HistoryEntry } from "@/bindings/HistoryEntry";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { createSession, resumeSession } from "@/features/sessions/state";
import { toggleSettings } from "@/features/settings/state";
import {
  activeTab,
  closePane,
  closeTab,
  focusSession,
  openInNewTab,
  splitWithNewSession,
} from "@/features/workspace/state";
import { findLeaf } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";
import { Picker, type PickerItem } from "@/shared/ui/Picker";

type Action = PickerItem;

type Props = {
  open: boolean;
  onClose: () => void;
  agents: AgentSummary[];
  sessions: SessionSummary[];
  history: HistoryEntry[];
  project: string | null;
};

export function CommandPalette({ open, onClose, agents, sessions, history, project }: Props) {
  const [query, setQuery] = useState("");

  const actions = useMemo(
    () => buildActions(agents, sessions, history, project, onClose),
    [agents, sessions, history, project, onClose],
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
    }
  }, [open]);

  return (
    <Picker
      open={open}
      onClose={onClose}
      query={query}
      onQuery={setQuery}
      placeholder={t("palette.placeholder")}
      items={matches}
    />
  );
}

function buildActions(
  agents: AgentSummary[],
  sessions: SessionSummary[],
  history: HistoryEntry[],
  project: string | null,
  onClose: () => void,
): Action[] {
  const actions: Action[] = [];

  for (const agent of project ? installed(agents) : []) {
    actions.push({
      id: `new:${agent.name}`,
      label: t("palette.newSession", { agent: agent.name }),
      run: () => {
        onClose();
        void createSession(project as string, agent.name, { rows: 24, cols: 80 }).then(
          openInNewTab,
        );
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

  for (const entry of project ? history : []) {
    actions.push({
      id: `resume:${entry.agent}:${entry.session_id}`,
      label: t("palette.resume", {
        agent: entry.agent,
        label: entry.label ?? entry.session_id.slice(0, 8),
      }),
      run: () => {
        onClose();
        void resumeSession(project as string, entry.agent, entry.session_id, {
          rows: 24,
          cols: 80,
        }).then(openInNewTab);
      },
    });
  }

  actions.push({
    id: "settings",
    label: t("palette.settings"),
    run: () => {
      onClose();
      toggleSettings();
    },
  });

  const tab = activeTab.value;
  if (tab) {
    const current = findLeaf(tab.root, tab.activeLeafId);
    for (const agent of project ? installed(agents) : []) {
      for (const split of SPLITS) {
        actions.push({
          id: `split:${split.direction}:${agent.name}`,
          label: t(split.key, { agent: agent.name }),
          run: () => {
            onClose();
            void splitWithNewSession(project as string, agent.name, split.direction);
          },
        });
      }
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

const SPLITS = [
  { direction: "row", key: "palette.splitRightWith" },
  { direction: "column", key: "palette.splitDownWith" },
] as const;

function installed(agents: AgentSummary[]): AgentSummary[] {
  return agents.filter((candidate) => candidate.resolved_path !== null);
}
