import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { SessionSummary } from "@/bindings/SessionSummary";
import type { TaskSummary } from "@/bindings/TaskSummary";
import { activeProjectId, projectSessions } from "@/features/projects/state";
import { openInNewTab } from "@/features/workspace/state";

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g");
const PEEK_TAIL = 2048;
const PEEK_INTERVAL = 2000;

export const tasks = signal<TaskSummary[]>([]);
export const failure = signal<string | null>(null);
export const peeks = signal<Record<string, string>>({});

export const running = computed(() => {
  const live = new Map<string, SessionSummary>();
  for (const session of projectSessions.value) {
    if (session.task && session.exit_code === null) {
      live.set(session.task, session);
    }
  }
  return live;
});

export async function loadTasks(): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    tasks.value = [];
    return;
  }
  try {
    tasks.value = await invoke<TaskSummary[]>("list_tasks", { project });
    failure.value = null;
  } catch (error) {
    tasks.value = [];
    failure.value = String(error);
  }
}

export async function startTask(task: TaskSummary): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  const session = await invoke<SessionSummary>("run_task", {
    project,
    task: task.name,
    command: task.command,
    size: { rows: 24, cols: 80 },
  });
  openInNewTab(session);
}

export function startPeeking(): () => void {
  const tick = () => {
    if (document.hidden) {
      return;
    }
    const live = running.value;
    if (live.size === 0) {
      return;
    }
    void Promise.all(
      [...live].map(async ([name, session]) => {
        const text = await invoke<string>("session_transcript", {
          id: session.id,
          tail: PEEK_TAIL,
        }).catch(() => "");
        return [name, text] as const;
      }),
    ).then((seen) => {
      peeks.value = Object.fromEntries(seen);
    });
  };

  tick();
  const timer = setInterval(tick, PEEK_INTERVAL);
  return () => clearInterval(timer);
}

export function lastLines(text: string, count: number): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(ANSI, "").trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(-count);
}

export type TaskGroup = {
  name: string;
  parent: TaskSummary | null;
  children: TaskSummary[];
};

export type TaskEntry = { kind: "task"; task: TaskSummary } | { kind: "group"; group: TaskGroup };

export function arrange(list: TaskSummary[]): TaskEntry[] {
  const groups = new Map<string, TaskGroup>();
  const entries: TaskEntry[] = [];

  for (const task of list) {
    if (!task.group) {
      entries.push({ kind: "task", task });
      continue;
    }
    let group = groups.get(task.group);
    if (!group) {
      group = { name: task.group, parent: null, children: [] };
      groups.set(task.group, group);
      entries.push({ kind: "group", group });
    }
    if (task.name === group.name) {
      group.parent = task;
    } else {
      group.children.push(task);
    }
  }

  return entries;
}

export function suffix(name: string, group: string): string {
  return name.slice(group.length).replace(/^[: ]/, "") || name;
}
