import { useEffect, useMemo, useState } from "preact/hooks";
import { toggleSettings } from "@/app/view";
import type { AgentSummary } from "@/bindings/AgentSummary";
import type { HistoryEntry } from "@/bindings/HistoryEntry";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { applyLayout, requestSession } from "@/features/sessions/pending";
import { resumeSession } from "@/features/sessions/state";
import { LAYOUT_PRESETS } from "@/features/workspace/layouts";
import {
  activeTab,
  closePane,
  closeTab,
  focusSession,
  openHomeRacing,
  openInNewTab,
} from "@/features/workspace/state";
import { findLeaf } from "@/features/workspace/tree";
import { isInstalled } from "@/shared/daemon";
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
  isGit: boolean;
};

export function CommandPalette({
  open,
  onClose,
  agents,
  sessions,
  history,
  project,
  isGit,
}: Props) {
  const [query, setQuery] = useState("");

  const actions = useMemo(
    () => buildActions(agents, sessions, history, project, isGit, onClose),
    [agents, sessions, history, project, isGit, onClose],
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
  isGit: boolean,
  onClose: () => void,
): Action[] {
  const actions: Action[] = [];

  for (const agent of project ? installed(agents) : []) {
    actions.push({
      id: `new:${agent.name}`,
      label: t("palette.newSession", { agent: agent.name }),
      run: () => {
        onClose();
        requestSession({
          project: project as string,
          agent: agent.name,
          direction: null,
          isGit,
        });
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

  if (project && installed(agents).filter((agent) => agent.agentic).length > 1) {
    actions.push({
      id: "race",
      label: t("palette.race"),
      run: () => {
        onClose();
        openHomeRacing();
      },
    });
  }

  actions.push({
    id: "settings",
    label: t("palette.settings"),
    keys: ["⌘", ","],
    run: () => {
      onClose();
      toggleSettings();
    },
  });

  actions.push({
    id: "shortcuts",
    label: t("palette.shortcuts"),
    keys: ["⌘", "H"],
    run: () => {
      onClose();
      toggleSettings("shortcuts");
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
            requestSession({
              project: project as string,
              agent: agent.name,
              direction: split.direction,
              isGit,
            });
          },
        });
      }
    }

    if (project) {
      for (const preset of LAYOUT_PRESETS) {
        actions.push({
          id: `layout:${preset.id}`,
          label: t("palette.layout", { name: t(preset.nameKey) }),
          preview: preset.preview,
          run: () => {
            onClose();
            void applyLayout(preset.spec);
          },
        });
      }
    }

    if (current) {
      actions.push({
        id: "close:pane",
        label: t("palette.closePane"),
        keys: ["⌘", "W"],
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
  return agents.filter(isInstalled);
}
