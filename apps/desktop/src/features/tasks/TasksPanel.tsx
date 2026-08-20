import cn from "cnfast";
import { useEffect } from "preact/hooks";
import { PanelActions } from "@/app/layout/PanelActions";
import type { SessionSummary } from "@/bindings/SessionSummary";
import type { TaskSummary } from "@/bindings/TaskSummary";
import { activeProject } from "@/features/projects/state";
import { requestClose } from "@/features/sessions/pending";
import {
  failure,
  lastLines,
  loadTasks,
  peeks,
  running,
  startTask,
  tasks,
} from "@/features/tasks/state";
import { focusSession, openInNewTab } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function TasksPanel() {
  const project = activeProject.value;
  const projectId = project?.id ?? null;

  useEffect(() => {
    void loadTasks();
  }, [projectId]);

  if (!project) {
    return <p class="p-2 text-faint">{t("files.noProject")}</p>;
  }

  return (
    <div class="flex h-full flex-col">
      <PanelActions>
        <button
          type="button"
          title={t("tasks.refresh")}
          onClick={() => void loadTasks()}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </PanelActions>

      {failure.value && <p class="px-2 text-state-failed">{failure.value}</p>}

      {tasks.value.length === 0 && !failure.value && (
        <p class="px-2 text-faint">{t("tasks.empty")}</p>
      )}

      <ul class="min-h-0 flex-1 overflow-auto pb-2">
        {tasks.value.map((task) => (
          <Row key={task.name} task={task} session={running.value.get(task.name) ?? null} />
        ))}
      </ul>
    </div>
  );
}

function Row({ task, session }: { task: TaskSummary; session: SessionSummary | null }) {
  const peek = session ? (peeks.value[task.name] ?? "") : "";
  const url = session?.url ?? null;
  const lines = peek ? lastLines(peek, 3) : [];

  return (
    <li class="group">
      <div class="flex items-center gap-2 px-2 py-px transition-colors hover:bg-raised">
        <button
          type="button"
          title={session ? t("tasks.stop") : t("tasks.start")}
          onClick={() => {
            if (session) {
              requestClose(session);
            } else {
              void startTask(task);
            }
          }}
          class={cn(
            "shrink-0 transition-colors",
            session ? "text-state-working hover:text-state-failed" : "text-faint hover:text-text",
          )}
        >
          <Icon name={session ? "stop" : "play"} size={12} />
        </button>

        <button
          type="button"
          onClick={() => {
            if (session && !focusSession(session.id)) {
              openInNewTab(session);
            }
          }}
          class="flex min-w-0 flex-1 items-center gap-2 py-px text-left"
        >
          {session && (
            <span
              aria-hidden="true"
              class="size-1.5 shrink-0 animate-pulse rounded-full bg-state-working"
            />
          )}
          <span class={cn("min-w-0 truncate", session ? "text-text" : "text-muted")}>
            {task.name}
          </span>
          {url && <span class="shrink-0 text-state-done">:{portOf(url)}</span>}
          <span class="ml-auto shrink-0 truncate text-faint opacity-0 transition-opacity group-hover:opacity-100">
            {task.command}
          </span>
        </button>
      </div>

      {lines.length > 0 && (
        <pre class="animate-veil-in overflow-hidden px-2 pb-1 pl-7 text-faint">
          {lines.map((line) => (
            <div key={line} class="truncate">
              {line}
            </div>
          ))}
        </pre>
      )}
    </li>
  );
}

function portOf(url: string): string {
  try {
    return new URL(url).port;
  } catch {
    return "";
  }
}
