import cn from "cnfast";
import { useState } from "preact/hooks";

import type { GitChange } from "@/bindings/GitChange";
import type { MergeReport } from "@/bindings/MergeReport";
import {
  gitFailure,
  gitStatus,
  gitTarget,
  mergeWorktree,
  refreshGit,
  selectTarget,
  worktrees,
} from "@/features/git/state";
import { activeProject } from "@/features/projects/state";
import { openDiff } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const MARKS: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  untracked: "?",
  conflicted: "!",
};

export function GitPanel() {
  const project = activeProject.value;
  const status = gitStatus.value;
  const target = gitTarget.value;
  const [report, setReport] = useState<MergeReport | null>(null);

  if (!project) {
    return <p class="p-2 text-faint">{t("files.noProject")}</p>;
  }
  if (!project.is_git) {
    return <p class="p-2 text-faint">{t("git.noRepo")}</p>;
  }

  return (
    <div class="flex h-full flex-col">
      <div class="flex shrink-0 items-center gap-2 px-2 py-1">
        <h2 class="uppercase tracking-wider text-faint">{t("dock.git")}</h2>
        <button
          type="button"
          title={t("git.refresh")}
          onClick={() => void refreshGit()}
          class="ml-auto shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </div>

      <ul class="shrink-0 border-b border-border pb-1">
        <Target
          id={null}
          label={project.name}
          branch={target === null ? (status?.branch ?? "") : ""}
          selected={target === null}
        />
        {worktrees.value.map((session) => (
          <Target
            key={session.id}
            id={session.id}
            label={session.title}
            branch={session.worktree?.branch ?? ""}
            selected={target === session.id}
          />
        ))}
      </ul>

      {gitFailure.value && <p class="px-2 py-1 text-state-failed">{gitFailure.value}</p>}

      {status && status.changes.length === 0 && (
        <p class="px-2 py-1 text-faint">{t("git.clean")}</p>
      )}

      <ul class="min-h-0 flex-1 overflow-auto py-1">
        {status?.changes.map((change) => (
          <Row key={change.path} change={change} session={target} />
        ))}
      </ul>

      {status?.isolated && target && (
        <div class="shrink-0 border-t border-border p-2">
          <button
            type="button"
            onClick={() => {
              setReport(null);
              void mergeWorktree(target)
                .then((outcome) => {
                  setReport(outcome);
                  void refreshGit();
                })
                .catch((error: unknown) => {
                  gitFailure.value = String(error);
                });
            }}
            class="w-full rounded border border-border py-1 text-muted transition-colors hover:bg-raised hover:text-text"
          >
            {t("git.merge", { base: status.base })}
          </button>
          {report?.type === "merged" && <p class="mt-1 text-state-done">{t("git.merged")}</p>}
          {report?.type === "conflicted" && (
            <p class="mt-1 text-state-blocked">
              {t("git.conflicted", { files: report.files.join(", ") })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

type TargetProps = {
  id: string | null;
  label: string;
  branch: string;
  selected: boolean;
};

function Target({ id, label, branch, selected }: TargetProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => selectTarget(id)}
        class={cn(
          "flex w-full items-center gap-2 px-2 py-px text-left transition-colors hover:bg-raised",
          selected ? "bg-raised text-text" : "text-muted",
        )}
      >
        <Icon name={id === null ? "files" : "branch"} size={12} class="shrink-0 text-faint" />
        <span class="truncate">{label}</span>
        {branch && <span class="ml-auto shrink-0 truncate text-faint">{branch}</span>}
      </button>
    </li>
  );
}

function Row({ change, session }: { change: GitChange; session: string | null }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => openDiff(session, change.path)}
        class="flex w-full items-center gap-2 px-2 py-px text-left text-muted transition-colors hover:bg-raised hover:text-text"
      >
        <span
          class={cn("w-3 shrink-0 text-center", {
            "text-state-done": change.kind === "added",
            "text-state-failed": change.kind === "deleted" || change.kind === "conflicted",
            "text-state-working": change.kind === "modified" || change.kind === "renamed",
            "text-faint": change.kind === "untracked",
          })}
        >
          {MARKS[change.kind] ?? "•"}
        </span>
        <span class="truncate">{change.path}</span>
      </button>
    </li>
  );
}
