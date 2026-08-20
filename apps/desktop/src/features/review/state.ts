import { signal } from "@preact/signals";

import type { GitTarget } from "@/bindings/GitTarget";
import { gitStatus, refreshGit, selectTarget } from "@/features/git/state";
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
