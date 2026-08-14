import cn from "cnfast";
import type { ComponentChildren } from "preact";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { ContextPanel } from "@/features/context/ContextPanel";
import { FilesPanel } from "@/features/files/FilesPanel";
import { GitPanel } from "@/features/git/GitPanel";
import { SessionsPanel } from "@/features/sessions/SessionsPanel";
import { TasksPanel } from "@/features/tasks/TasksPanel";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";

export type DockPanel = "sessions" | "files" | "git" | "context" | "tasks";

const PANELS: { id: DockPanel; icon: IconName; label: () => string }[] = [
  { id: "sessions", icon: "sessions", label: () => t("dock.sessions") },
  { id: "files", icon: "files", label: () => t("dock.files") },
  { id: "git", icon: "branch", label: () => t("dock.git") },
  { id: "context", icon: "context", label: () => t("dock.context") },
  { id: "tasks", icon: "play", label: () => t("dock.tasks") },
];

type Props = {
  header?: ComponentChildren;
  panel: DockPanel;
  onPanel: (panel: DockPanel) => void;
  sessions: SessionSummary[];
  elsewhere: SessionSummary[];
  projects: ProjectSummary[];
  floating?: boolean;
};

export function Dock({
  header,
  panel,
  onPanel,
  sessions,
  elsewhere,
  projects,
  floating = false,
}: Props) {
  return (
    <aside
      class={cn(
        "flex h-full w-full flex-col overflow-hidden bg-surface",
        floating ? "m-2 rounded-r-xl shadow-2xl" : "border-r border-border",
      )}
    >
      <div
        data-tauri-drag-region
        class="flex h-9 shrink-0 select-none items-center"
        style={{ paddingLeft: "max(var(--apex-controls-start, 0px), 0.75rem)" }}
      >
        {header}
      </div>

      {PANELS.length > 1 && (
        <nav class="flex shrink-0 gap-1 border-b border-border px-1 py-1 min-h-8.5">
          {PANELS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={entry.label()}
              onClick={() => onPanel(entry.id)}
              class={cn(
                "flex size-6 items-center justify-center rounded transition-colors",
                panel === entry.id ? "bg-raised text-text" : "text-faint hover:text-text",
              )}
            >
              <Icon name={entry.icon} />
            </button>
          ))}
        </nav>
      )}

      <div class="min-h-0 flex-1">
        {panel === "tasks" ? (
          <TasksPanel />
        ) : panel === "context" ? (
          <ContextPanel />
        ) : panel === "git" ? (
          <GitPanel />
        ) : panel === "files" ? (
          <FilesPanel />
        ) : (
          <SessionsPanel sessions={sessions} elsewhere={elsewhere} projects={projects} />
        )}
      </div>
    </aside>
  );
}
