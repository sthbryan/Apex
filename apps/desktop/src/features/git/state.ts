import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { GitCommit } from "@/bindings/GitCommit";
import type { GitStatus } from "@/bindings/GitStatus";
import type { MergeReport } from "@/bindings/MergeReport";
import { activeProjectId, projectSessions } from "@/features/projects/state";
import { countdown } from "@/features/usage/format";
import { t } from "@/shared/i18n";

const INTERVAL = 5000;

export const gitTab = signal<"changes" | "history">("changes");
export const commits = signal<GitCommit[]>([]);
export const gitTarget = signal<string | null>(null);
export const gitStatus = signal<GitStatus | null>(null);
export const gitFailure = signal<string | null>(null);

export const worktrees = computed(() =>
  projectSessions.value.filter((session) => session.worktree !== null),
);

export function selectTarget(session: string | null): void {
  gitTarget.value = session;
  void refreshGit();
  if (gitTab.value === "history") {
    void readLog();
  }
}

export async function refreshGit(): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    gitStatus.value = null;
    return;
  }
  try {
    gitStatus.value = await invoke<GitStatus>("git_status", {
      project,
      session: gitTarget.value,
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
  return () => clearInterval(timer);
}

export async function readDiff(
  session: string | null,
  path: string,
  commit: string | null,
): Promise<string> {
  return invoke<string>("git_diff", {
    project: activeProjectId.value,
    session,
    path,
    commit,
  });
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
      session: gitTarget.value,
      limit: 100,
    });
    gitFailure.value = null;
  } catch (error) {
    commits.value = [];
    gitFailure.value = String(error);
  }
}

export function showTab(tab: "changes" | "history"): void {
  gitTab.value = tab;
  if (tab === "history") {
    void readLog();
  }
}

export function since(when: number): string {
  return countdown(Date.now() / 1000 - when) ?? t("git.now");
}

export async function mergeWorktree(session: string): Promise<MergeReport> {
  return invoke<MergeReport>("merge_worktree", { session });
}
