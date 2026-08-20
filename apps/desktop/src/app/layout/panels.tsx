import type { ComponentType } from "preact";
import { lazy } from "preact/compat";

import type { DockPanel } from "@/app/layout/state";
import { gitStatus, pending } from "@/features/git/state";
import { projectSessions } from "@/features/projects/state";
import { running } from "@/features/tasks/state";
import { t } from "@/shared/i18n";
import type { IconName } from "@/shared/ui/Icon";

export type PanelBadge = "blocked" | "working" | "dirty" | "done";

type Entry = {
  icon: IconName;
  label: () => string;
  badge?: () => PanelBadge | null;
  View: ComponentType;
};

const SessionPanel = lazy(async () => ({
  default: (await import("@/features/sessions/SessionsPanel")).SessionsPanel,
}));
const FilesPanel = lazy(async () => ({
  default: (await import("@/features/files/FilesPanel")).FilesPanel,
}));
const ChangesPanel = lazy(async () => ({
  default: (await import("@/features/git/ChangesPanel")).ChangesPanel,
}));
const ReviewPanel = lazy(async () => ({
  default: (await import("@/features/review/ReviewPanel")).ReviewPanel,
}));
const HistoryPanel = lazy(async () => ({
  default: (await import("@/features/git/HistoryPanel")).HistoryPanel,
}));
const ContextPanel = lazy(async () => ({
  default: (await import("@/features/context/ContextPanel")).ContextPanel,
}));
const TasksPanel = lazy(async () => ({
  default: (await import("@/features/tasks/TasksPanel")).TasksPanel,
}));

function reviewBadge(): PanelBadge | null {
  const waiting = pending.value;
  if (waiting.length === 0) {
    return null;
  }
  return waiting.some((review) => review.state === "done") ? "done" : "dirty";
}

export const DOCK_PANELS: Record<DockPanel, Entry> = {
  sessions: {
    icon: "sessions",
    label: () => t("dock.sessions"),
    badge: () =>
      projectSessions.value.some((session) => session.state === "blocked") ? "blocked" : null,
    View: SessionPanel,
  },
  files: { icon: "files", label: () => t("dock.files"), View: FilesPanel },
  git: {
    icon: "branch",
    label: () => t("git.changes"),
    badge: () => ((gitStatus.value?.changes.length ?? 0) > 0 ? "dirty" : null),
    View: ChangesPanel,
  },
  review: {
    icon: "inbox",
    label: () => t("review.title"),
    badge: () => reviewBadge(),
    View: ReviewPanel,
  },
  history: { icon: "history", label: () => t("git.history"), View: HistoryPanel },
  context: { icon: "context", label: () => t("dock.context"), View: ContextPanel },
  tasks: {
    icon: "play",
    label: () => t("dock.tasks"),
    badge: () => (running.value.size > 0 ? "working" : null),
    View: TasksPanel,
  },
};

export const DOCK_PANEL_ORDER = Object.keys(DOCK_PANELS) as DockPanel[];
