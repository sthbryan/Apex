import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { GitStatus } from "@/bindings/GitStatus";
import type { MergeReport } from "@/bindings/MergeReport";
import { activeProjectId, projectSessions } from "@/features/projects/state";

const INTERVAL = 5000;

export const gitTarget = signal<string | null>(null);
export const gitStatus = signal<GitStatus | null>(null);
export const gitFailure = signal<string | null>(null);

export const worktrees = computed(() =>
  projectSessions.value.filter((session) => session.worktree !== null),
);

export function selectTarget(session: string | null): void {
  gitTarget.value = session;
  void refreshGit();
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

export async function readDiff(session: string | null, path: string): Promise<string> {
  return invoke<string>("git_diff", { project: activeProjectId.value, session, path });
}

export async function mergeWorktree(session: string): Promise<MergeReport> {
  return invoke<MergeReport>("merge_worktree", { session });
}
