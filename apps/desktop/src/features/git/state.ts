import { invoke } from "@tauri-apps/api/core";

import type { GitStatus } from "@/bindings/GitStatus";
import type { MergeReport } from "@/bindings/MergeReport";

export async function readStatus(session: string): Promise<GitStatus> {
  return invoke<GitStatus>("git_status", { session });
}

export async function readDiff(session: string, path: string): Promise<string> {
  return invoke<string>("git_diff", { session, path });
}

export async function mergeWorktree(session: string): Promise<MergeReport> {
  return invoke<MergeReport>("merge_worktree", { session });
}
