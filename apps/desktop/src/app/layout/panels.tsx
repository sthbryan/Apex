import type { ComponentType } from "preact";
import { lazy } from "preact/compat";

import type { DockPanel } from "@/app/layout/state";
import { t } from "@/shared/i18n";
import type { IconName } from "@/shared/ui/Icon";

type Entry = {
  icon: IconName;
  label: () => string;
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
const HistoryPanel = lazy(async () => ({
  default: (await import("@/features/git/HistoryPanel")).HistoryPanel,
}));
const ContextPanel = lazy(async () => ({
  default: (await import("@/features/context/ContextPanel")).ContextPanel,
}));
const TasksPanel = lazy(async () => ({
  default: (await import("@/features/tasks/TasksPanel")).TasksPanel,
}));

export const DOCK_PANELS: Record<DockPanel, Entry> = {
  sessions: { icon: "sessions", label: () => t("dock.sessions"), View: SessionPanel },
  files: { icon: "files", label: () => t("dock.files"), View: FilesPanel },
  git: { icon: "branch", label: () => t("git.changes"), View: ChangesPanel },
  history: { icon: "history", label: () => t("git.history"), View: HistoryPanel },
  context: { icon: "context", label: () => t("dock.context"), View: ContextPanel },
  tasks: { icon: "play", label: () => t("dock.tasks"), View: TasksPanel },
};

export const DOCK_PANEL_ORDER = Object.keys(DOCK_PANELS) as DockPanel[];
