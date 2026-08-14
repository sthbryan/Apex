import type { ComponentType } from "preact";

import type { DockPanel } from "@/app/layout/state";
import { ContextPanel } from "@/features/context/ContextPanel";
import { FilesPanel } from "@/features/files/FilesPanel";
import { GitPanel } from "@/features/git/GitPanel";
import { SessionsPanel } from "@/features/sessions/SessionsPanel";
import { TasksPanel } from "@/features/tasks/TasksPanel";
import { t } from "@/shared/i18n";
import type { IconName } from "@/shared/ui/Icon";

type Entry = {
  icon: IconName;
  label: () => string;
  View: ComponentType;
};

export const DOCK_PANELS: Record<DockPanel, Entry> = {
  sessions: { icon: "sessions", label: () => t("dock.sessions"), View: SessionsPanel },
  files: { icon: "files", label: () => t("dock.files"), View: FilesPanel },
  git: { icon: "branch", label: () => t("dock.git"), View: GitPanel },
  context: { icon: "context", label: () => t("dock.context"), View: ContextPanel },
  tasks: { icon: "play", label: () => t("dock.tasks"), View: TasksPanel },
};

export const DOCK_PANEL_ORDER = Object.keys(DOCK_PANELS) as DockPanel[];
