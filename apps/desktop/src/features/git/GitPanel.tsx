import cn from "cnfast";
import { useState } from "preact/hooks";

import type { GitChange } from "@/bindings/GitChange";
import type { GitStatus } from "@/bindings/GitStatus";
import type { MergeReport } from "@/bindings/MergeReport";
import { CommitBox } from "@/features/git/CommitBox";
import {
  commits,
  gitFailure,
  gitStatus,
  gitTab,
  gitTarget,
  mergeWorktree,
  readLog,
  refreshGit,
  selectTarget,
  setStaged,
  showTab,
  since,
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
      <div class="flex shrink-0 items-center gap-3 px-2 py-1">
        {(["changes", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => showTab(tab)}
            class={cn(
              "uppercase tracking-wider transition-colors",
              gitTab.value === tab ? "text-text" : "text-faint hover:text-muted",
            )}
          >
            {t(`git.${tab}`)}
          </button>
        ))}
        <button
          type="button"
          title={t("git.refresh")}
          onClick={() => {
            void refreshGit();
            if (gitTab.value === "history") {
              void readLog();
            }
          }}
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

      {gitTab.value === "history" ? (
        <History session={target} />
      ) : (
        <Changes status={status} session={target} />
      )}

      {status && gitTab.value === "changes" && <CommitBox status={status} />}

      {status?.isolated && target && gitTab.value === "changes" && (
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

function Changes({ status, session }: { status: GitStatus | null; session: string | null }) {
  if (status && status.changes.length === 0) {
    return <p class="px-2 py-1 text-faint">{t("git.clean")}</p>;
  }
  return (
    <div class="min-h-0 flex-1 overflow-auto py-1">
      <Section
        label={t("git.staged")}
        changes={status?.changes.filter((change) => change.staged) ?? []}
        session={session}
        staged
      />
      <Section
        label={t("git.tracked")}
        changes={
          status?.changes.filter((change) => !change.staged && change.kind !== "untracked") ?? []
        }
        session={session}
        staged={false}
      />
      <Section
        label={t("git.untracked")}
        changes={status?.changes.filter((change) => change.kind === "untracked") ?? []}
        session={session}
        staged={false}
      />
    </div>
  );
}

function History({ session }: { session: string | null }) {
  if (commits.value.length === 0) {
    return <p class="px-2 py-1 text-faint">{t("git.noHistory")}</p>;
  }
  return (
    <ul class="min-h-0 flex-1 overflow-auto py-1">
      {commits.value.map((commit) => (
        <li key={commit.id}>
          <button
            type="button"
            onClick={() => openDiff(session, "", commit.id)}
            class="flex w-full flex-col gap-0.5 px-2 py-1 text-left transition-colors hover:bg-raised"
          >
            <span class="flex w-full items-baseline gap-2">
              <span class="truncate text-muted">{commit.summary}</span>
              <span class="ml-auto shrink-0 tabular-nums text-faint">{since(commit.when)}</span>
            </span>
            <span class="flex w-full items-baseline gap-2 text-faint">
              <span class="shrink-0 tabular-nums">{commit.short}</span>
              <span class="truncate">{commit.author}</span>
              {commit.refs && (
                <span class="ml-auto shrink-0 truncate text-state-working">
                  {commit.refs.split(", ")[0]}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
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

function Section({
  label,
  changes,
  session,
  staged,
}: {
  label: string;
  changes: GitChange[];
  session: string | null;
  staged: boolean;
}) {
  if (changes.length === 0) {
    return null;
  }
  const added = changes.reduce((total, change) => total + change.added, 0);
  const removed = changes.reduce((total, change) => total + change.removed, 0);

  return (
    <section class="mb-1">
      <h3 class="flex items-center gap-2 px-2 uppercase tracking-wider text-faint">
        <button
          type="button"
          title={staged ? t("git.unstageAll") : t("git.stageAll")}
          onClick={() =>
            void setStaged(
              changes.map((change) => change.path),
              !staged,
            ).catch((error: unknown) => {
              gitFailure.value = String(error);
            })
          }
          class="transition-colors hover:text-text"
        >
          {label}
        </button>
        <span class="ml-auto shrink-0 tabular-nums">
          <span class="text-state-done">+{added}</span>{" "}
          <span class="text-state-failed">−{removed}</span>
        </span>
      </h3>
      <ul>
        {changes.map((change) => (
          <Row key={change.path} change={change} session={session} />
        ))}
      </ul>
    </section>
  );
}

function Row({ change, session }: { change: GitChange; session: string | null }) {
  return (
    <li class="group flex items-center gap-1 px-2 transition-colors hover:bg-raised">
      <button
        type="button"
        title={change.staged ? t("git.unstage") : t("git.stage")}
        onClick={() =>
          void setStaged([change.path], !change.staged).catch((error: unknown) => {
            gitFailure.value = String(error);
          })
        }
        class={cn(
          "flex size-3.5 shrink-0 items-center justify-center rounded-xs border transition-colors",
          change.staged
            ? "border-accent bg-accent text-bg"
            : "border-border text-transparent hover:border-muted",
        )}
      >
        <Icon name="check" size={10} />
      </button>
      <button
        type="button"
        onClick={() => openDiff(session, change.path)}
        class="flex min-w-0 flex-1 items-center gap-2 py-px text-left text-muted transition-colors group-hover:text-text"
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
        <span class="ml-auto shrink-0 tabular-nums text-faint">
          {change.added > 0 && <span class="text-state-done">+{change.added}</span>}
          {change.removed > 0 && <span class="text-state-failed"> −{change.removed}</span>}
        </span>
      </button>
    </li>
  );
}
