import cn from "cnfast";
import type { ComponentChildren } from "preact";

import { DockResize } from "@/app/layout/DockResize";
import { type DockPanel, dockPanel, setDockPanel } from "@/app/layout/state";
import { ContextPanel } from "@/features/context/ContextPanel";
import { FilesPanel } from "@/features/files/FilesPanel";
import { GitPanel } from "@/features/git/GitPanel";
import { foreignSessions, projectSessions, projects } from "@/features/projects/state";
import { SessionsPanel } from "@/features/sessions/SessionsPanel";
import { TasksPanel } from "@/features/tasks/TasksPanel";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";

const PANELS: { id: DockPanel; icon: IconName; label: () => string }[] = [
  { id: "sessions", icon: "sessions", label: () => t("dock.sessions") },
  { id: "files", icon: "files", label: () => t("dock.files") },
  { id: "git", icon: "branch", label: () => t("dock.git") },
  { id: "context", icon: "context", label: () => t("dock.context") },
  { id: "tasks", icon: "play", label: () => t("dock.tasks") },
];

type Props = {
  header?: ComponentChildren;
  floating?: boolean;
};

export function Dock({ header, floating = false }: Props) {
  const panel = dockPanel.value;
  return (
    <aside
      class={cn(
        "relative flex h-full w-full flex-col overflow-hidden border-r border-border transition-[border-radius,box-shadow,background-color] duration-(--apex-dock)",
        floating
          ? "rounded-r-xl bg-bg shadow-[8px_0_28px_rgba(0,0,0,0.28)]"
          : "rounded-none bg-surface shadow-none",
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
              onClick={() => setDockPanel(entry.id)}
              class={cn(
                "flex size-6 items-center justify-center rounded transition-colors",
                panel === entry.id
                  ? "bg-raised text-text"
                  : floating
                    ? "text-muted hover:text-text"
                    : "text-faint hover:text-text",
              )}
            >
              <Icon name={entry.icon} />
            </button>
          ))}
        </nav>
      )}

      <DockResize />

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
          <SessionsPanel
            sessions={projectSessions.value}
            elsewhere={foreignSessions.value}
            projects={projects.value}
          />
        )}
      </div>
    </aside>
  );
}
