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
export const cursor = signal(0);

export async function openReview(target: GitTarget): Promise<void> {
  selectTarget(target);
  reviewing.value = target;
  await refreshGit();
  cursor.value = 0;
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
  const landing = at === -1 ? 0 : at + delta;
  const next = files[landing];
  if (next) {
    cursor.value = landing;
    openDiff(target, next);
  }
}

export function settleReview(target: GitTarget, path: string): void {
  const files = reviewFiles();
  if (files.includes(path)) {
    cursor.value = files.indexOf(path);
    return;
  }
  if (files.length === 0) {
    return;
  }
  const landing = Math.min(cursor.value, files.length - 1);
  cursor.value = landing;
  openDiff(target, files[landing]);
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
