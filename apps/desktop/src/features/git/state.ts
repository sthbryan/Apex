import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { DiffScope } from "@/bindings/DiffScope";
import type { GitCommit } from "@/bindings/GitCommit";
import type { GitStatus } from "@/bindings/GitStatus";
import type { GitTarget } from "@/bindings/GitTarget";
import type { MergeReport } from "@/bindings/MergeReport";
import type { WorktreeEntry } from "@/bindings/WorktreeEntry";
import { activeProjectId, projectSessions } from "@/features/projects/state";
import { roughly } from "@/features/usage/format";
import { t } from "@/shared/i18n";

const INTERVAL = 5000;

export const commits = signal<GitCommit[]>([]);
export const gitTarget = signal<GitTarget>({ type: "project" });
export const gitStatus = signal<GitStatus | null>(null);
export const gitFailure = signal<string | null>(null);
export const worktrees = signal<WorktreeEntry[]>([]);

export const sessionOfWorktree = computed(() => {
  const owners = new Map<string, string>();
  for (const session of projectSessions.value) {
    if (session.worktree) {
      owners.set(session.worktree.path, session.title);
    }
  }
  return owners;
});

export function sameTarget(left: GitTarget, right: GitTarget): boolean {
  if (left.type !== right.type) {
    return false;
  }
  if (left.type === "session" && right.type === "session") {
    return left.id === right.id;
  }
  if (left.type === "worktree" && right.type === "worktree") {
    return left.path === right.path;
  }
  return true;
}

export function selectTarget(target: GitTarget): void {
  gitTarget.value = target;
  void refreshGit();
  void readLog();
}

export async function refreshGit(): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    gitStatus.value = null;
    worktrees.value = [];
    return;
  }
  try {
    const trees = await invoke<WorktreeEntry[]>("list_worktrees", { project });
    worktrees.value = trees;
    const target = gitTarget.value;
    if (target.type === "worktree" && !trees.some((tree) => tree.path === target.path)) {
      gitTarget.value = { type: "project" };
      void readLog();
    }
    gitStatus.value = await invoke<GitStatus>("git_status", {
      project,
      target: gitTarget.value,
    });
    gitFailure.value = null;
  } catch (error) {
    gitStatus.value = null;
    gitFailure.value = String(error);
  }
}

export function startGitWatch(): () => void {
  const tick = () => {
    if (!document.hidden) {
      void refreshGit();
    }
  };
  tick();
  const timer = setInterval(tick, INTERVAL);
  const unsub = activeProjectId.subscribe(() => {
    gitTarget.value = { type: "project" };
    commits.value = [];
    gitStatus.value = null;
    gitFailure.value = null;
    worktrees.value = [];
    tick();
    void readLog();
  });
  return () => {
    clearInterval(timer);
    unsub();
  };
}

export async function readDiff(
  target: GitTarget,
  path: string,
  commit: string | null,
  scope: DiffScope = "both",
): Promise<string> {
  return invoke<string>("git_diff", {
    project: activeProjectId.value,
    target,
    path,
    commit,
    scope,
  });
}

export async function readHunks(
  target: GitTarget,
  path: string,
  scope: DiffScope,
): Promise<string[]> {
  return invoke<string[]>("git_hunks", {
    project: activeProjectId.value,
    target,
    path,
    scope,
  });
}

export async function setStaged(paths: string[], staged: boolean): Promise<void> {
  await invoke("git_stage", {
    project: activeProjectId.value,
    target: gitTarget.value,
    paths,
    staged,
  });
  await refreshGit();
}

export async function stageHunk(target: GitTarget, patch: string, staged: boolean): Promise<void> {
  await invoke("git_stage_hunk", {
    project: activeProjectId.value,
    target,
    patch,
    staged,
  });
  await refreshGit();
}

export async function commitStaged(message: string): Promise<GitCommit> {
  const commit = await invoke<GitCommit>("git_commit", {
    project: activeProjectId.value,
    target: gitTarget.value,
    message,
  });
  await refreshGit();
  await readLog();
  return commit;
}

export async function readLog(): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    commits.value = [];
    return;
  }
  try {
    commits.value = await invoke<GitCommit[]>("git_log", {
      project,
      target: gitTarget.value,
      limit: 100,
    });
    gitFailure.value = null;
  } catch (error) {
    commits.value = [];
    gitFailure.value = String(error);
  }
}

export function since(when: number): string {
  return roughly(Date.now() / 1000 - when) ?? t("git.now");
}

export async function dropWorktree(path: string, branch: string): Promise<void> {
  await invoke("remove_worktree", { project: activeProjectId.value, path, branch });
  if (gitTarget.value.type === "worktree" && gitTarget.value.path === path) {
    gitTarget.value = { type: "project" };
    void readLog();
  }
  await refreshGit();
}

export async function mergeWorktree(target: GitTarget): Promise<MergeReport> {
  return invoke<MergeReport>("merge_worktree", {
    project: activeProjectId.value,
    target,
  });
}
