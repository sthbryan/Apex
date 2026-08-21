import { signal } from "@preact/signals";

import type { GitTarget } from "@/bindings/GitTarget";
import {
  gitStatus,
  readDiff,
  refreshGit,
  refreshPending,
  rejectHunk,
  sameTarget,
  selectTarget,
} from "@/features/git/state";
import { openDiff } from "@/features/workspace/state";

export const reviewing = signal<GitTarget | null>(null);

export async function openReview(target: GitTarget): Promise<void> {
  selectTarget(target);
  reviewing.value = target;
  await refreshGit();
  const first = gitStatus.value?.changes[0];
  if (first) {
    openDiff(target, first.path);
  }
}

export function inReview(target: GitTarget): boolean {
  const at = reviewing.value;
  return at !== null && sameTarget(at, target);
}

export function reviewFiles(): string[] {
  return (gitStatus.value?.changes ?? []).map((change) => change.path);
}

export function stepReview(target: GitTarget, path: string, delta: number): void {
  const files = reviewFiles();
  const at = files.indexOf(path);
  const next = at === -1 ? files[0] : files[at + delta];
  if (next) {
    openDiff(target, next);
  }
}

export async function rejectTarget(target: GitTarget): Promise<void> {
  selectTarget(target);
  await refreshGit();
  const loose = (gitStatus.value?.changes ?? []).filter((change) => !change.staged);
  for (const change of loose) {
    const patch = await readDiff(target, change.path, null, "unstaged");
    if (patch.trim()) {
      await rejectHunk(target, patch);
    }
  }
  await refreshGit();
  await refreshPending();
}
