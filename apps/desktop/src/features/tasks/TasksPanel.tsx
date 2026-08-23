import { Chip, Dot, ListRow } from "@apex/ui";
import cn from "cnfast";
import { useEffect, useState } from "preact/hooks";
import { PanelActions } from "@/app/layout/PanelActions";
import type { SessionSummary } from "@/bindings/SessionSummary";
import type { TaskSummary } from "@/bindings/TaskSummary";
import { openWeb } from "@/features/browser/state";
import { activeProject } from "@/features/projects/state";
import { requestClose } from "@/features/sessions/pending";
import {
  arrange,
  failure,
  lastLines,
  loadTasks,
  peeks,
  running,
  startTask,
  suffix,
  type TaskGroup,
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
    <div class="dock-view">
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

      {failure.value && <p class="px-1.5 text-state-failed">{failure.value}</p>}

      {tasks.value.length === 0 && !failure.value && (
        <p class="px-1.5 text-faint">{t("tasks.empty")}</p>
      )}

      {arrange(tasks.value).map((entry) =>
        entry.kind === "task" ? (
          <Row
            key={entry.task.name}
            task={entry.task}
            label={entry.task.name}
            session={running.value.get(entry.task.name) ?? null}
          />
        ) : (
          <Group key={entry.group.name} group={entry.group} />
        ),
      )}
    </div>
  );
}

function Group({ group }: { group: TaskGroup }) {
  const live = running.value;
  const members = group.parent ? [group.parent, ...group.children] : group.children;
  const busy = members.some((task) => live.has(task.name));
  const [wanted, setWanted] = useState<boolean | null>(null);
  const open = wanted ?? busy;
  const toggle = () => setWanted(!open);

  return (
    <>
      {group.parent ? (
        <Row
          task={group.parent}
          label={group.name}
          session={live.get(group.name) ?? null}
          open={open}
          onToggle={toggle}
        />
      ) : (
        <ListRow
          label={group.name}
          class="text-muted"
          lead={<Chevron open={open} busy={busy} />}
          onClick={toggle}
        />
      )}

      {open &&
        group.children.map((task) => (
          <Row
            key={task.name}
            task={task}
            label={suffix(task.name, group.name)}
            session={live.get(task.name) ?? null}
            indent
          />
        ))}
    </>
  );
}

function Chevron({ open, busy }: { open: boolean; busy: boolean }) {
  return (
    <span class="flex size-3 shrink-0 items-center justify-center">
      <Icon
        name="chevron"
        size={12}
        class={cn(
          "transition-transform",
          open ? "text-faint" : "-rotate-90",
          busy && !open ? "text-state-working" : "text-faint",
        )}
      />
    </span>
  );
}

function Row({
  task,
  label,
  session,
  indent,
  open,
  onToggle,
}: {
  task: TaskSummary;
  label: string;
  session: SessionSummary | null;
  indent?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const peek = session ? (peeks.value[task.name] ?? "") : "";
  const lines = peek ? lastLines(peek, 3) : [];
  const url = session?.url ?? null;

  if (asking) {
    return (
      <div class={cn("flex items-center gap-2 rounded-sm bg-raised px-2 py-1", indent && "pl-6")}>
        <span class="min-w-0 flex-1 truncate text-muted">{t("tasks.ask")}</span>
        <button
          type="button"
          onClick={() => {
            setAsking(false);
            void startTask(task);
          }}
          class="shrink-0 text-state-failed transition-colors hover:underline"
        >
          {t("tasks.askYes")}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          {t("tasks.askNo")}
        </button>
      </div>
    );
  }

  return (
    <div class={cn("group", indent && "pl-4")}>
      <ListRow
        as="div"
        label={label}
        class={session ? "text-text" : "text-muted"}
        lead={
          <>
            {onToggle ? (
              <button type="button" onClick={onToggle}>
                <Chevron open={open === true} busy={false} />
              </button>
            ) : (
              <span class="size-3" />
            )}
            <button
              type="button"
              title={session ? t("tasks.stop") : t("tasks.start")}
              onClick={() => {
                if (session) {
                  requestClose(session);
                } else if (task.risky) {
                  setAsking(true);
                } else {
                  void startTask(task);
                }
              }}
              class={cn(
                "transition-colors",
                session
                  ? "text-state-working hover:text-state-failed"
                  : "text-faint hover:text-text",
              )}
            >
              <Icon name={session ? "stop" : "play"} size={12} />
            </button>
            {session && <Dot state="working" size="sm" />}
          </>
        }
        trail={
          <>
            {url && (
              <Chip
                as="button"
                tone="done"
                title={t("tasks.preview")}
                onClick={(event) => {
                  event.stopPropagation();
                  openWeb(url);
                }}
              >
                :{portOf(url)}
              </Chip>
            )}
            <span class="truncate opacity-0 transition-opacity group-hover:opacity-100">
              {task.command}
            </span>
          </>
        }
        onClick={() => {
          if (session && !focusSession(session.id)) {
            openInNewTab(session);
          }
        }}
      />

      {lines.length > 0 && (
        <pre class="animate-veil-in overflow-hidden px-2 pb-1 pl-10 text-faint">
          {lines.map((line) => (
            <div key={line} class="truncate">
              {line}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

function portOf(url: string): string {
  try {
    return new URL(url).port;
  } catch {
    return "";
  }
}
