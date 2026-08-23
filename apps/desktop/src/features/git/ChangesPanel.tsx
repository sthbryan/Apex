import { BranchBar, Checkbox, DiffStat, ListRow, SectionLabel } from "@apex/ui";
import cn from "cnfast";
import { useState } from "preact/hooks";

import { PanelActions } from "@/app/layout/PanelActions";
import type { GitChange } from "@/bindings/GitChange";
import type { GitStatus } from "@/bindings/GitStatus";
import type { GitTarget } from "@/bindings/GitTarget";
import type { MergeReport } from "@/bindings/MergeReport";
import { CommitBox } from "@/features/git/CommitBox";
import { SyncActions } from "@/features/git/SyncActions";
import {
  gitFailure,
  gitStatus,
  gitTarget,
  mergeWorktree,
  refreshGit,
  setStaged,
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

const TONES: Record<string, string> = {
  added: "text-git-added",
  deleted: "text-git-removed",
  conflicted: "text-git-conflict",
  modified: "text-git-modified",
  renamed: "text-git-modified",
  untracked: "text-faint",
};

export function ChangesPanel() {
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
    <div class="dock-view dock-fixed">
      <PanelActions>
        <button
          type="button"
          title={t("git.refresh")}
          onClick={() => void refreshGit()}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </PanelActions>

      <div class="dock-scroll">
        {gitFailure.value && <p class="px-1.5 text-state-failed">{gitFailure.value}</p>}

        {status && (
          <BranchBar
            branch={status.branch}
            ahead={status.ahead}
            behind={status.behind}
            lead={<Icon name="branch" size={12} />}
            actions={<SyncActions status={status} />}
          />
        )}

        <Changes status={status} target={target} />
      </div>

      {status && <CommitBox status={status} />}

      {status?.isolated && (
        <div class="shrink-0 border-t border-border p-2">
          <button
            type="button"
            disabled={(status?.changes.length ?? 0) > 0}
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
            class="w-full rounded border border-border py-1 text-muted transition-colors enabled:hover:bg-raised enabled:hover:text-text disabled:opacity-40"
          >
            {t("git.merge", { base: status.base })}
          </button>
          {status.changes.length > 0 && <p class="mt-1 text-faint">{t("review.commitFirst")}</p>}
          {report?.type === "merged" && <p class="mt-1 text-git-added">{t("git.merged")}</p>}
          {report?.type === "conflicted" && (
            <p class="mt-1 text-git-conflict">
              {t("git.conflicted", { files: report.files.join(", ") })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Changes({ status, target }: { status: GitStatus | null; target: GitTarget }) {
  if (status && status.changes.length === 0) {
    return <p class="px-1.5 py-1 text-faint">{t("git.clean")}</p>;
  }
  return (
    <>
      <Section
        label={t("git.staged")}
        changes={status?.changes.filter((change) => change.staged) ?? []}
        target={target}
        staged
      />
      <Section
        label={t("git.tracked")}
        changes={
          status?.changes.filter((change) => !change.staged && change.kind !== "untracked") ?? []
        }
        target={target}
        staged={false}
      />
      <Section
        label={t("git.untracked")}
        changes={status?.changes.filter((change) => change.kind === "untracked") ?? []}
        target={target}
        staged={false}
      />
    </>
  );
}

function Section({
  label,
  changes,
  target,
  staged,
}: {
  label: string;
  changes: GitChange[];
  target: GitTarget;
  staged: boolean;
}) {
  if (changes.length === 0) {
    return null;
  }
  const added = changes.reduce((total, change) => total + change.added, 0);
  const removed = changes.reduce((total, change) => total + change.removed, 0);

  return (
    <>
      <SectionLabel count={changes.length} action={<DiffStat added={added} removed={removed} />}>
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
          class="uppercase transition-colors hover:text-text"
        >
          {label}
        </button>
      </SectionLabel>
      {changes.map((change) => (
        <Row key={change.path} change={change} target={target} />
      ))}
    </>
  );
}

function Row({ change, target }: { change: GitChange; target: GitTarget }) {
  return (
    <ListRow
      as="div"
      role="button"
      tabIndex={0}
      mono
      label={change.path}
      title={change.path}
      lead={
        <>
          <span
            class="flex"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={change.staged}
              label={change.staged ? t("git.unstage") : t("git.stage")}
              onChange={() =>
                void setStaged([change.path], !change.staged).catch((error: unknown) => {
                  gitFailure.value = String(error);
                })
              }
            />
          </span>
          <span class={cn("w-3 shrink-0 text-center", TONES[change.kind])}>
            {MARKS[change.kind] ?? "•"}
          </span>
        </>
      }
      trail={
        <DiffStat
          added={change.added > 0 ? change.added : undefined}
          removed={change.removed > 0 ? change.removed : undefined}
        />
      }
      onClick={() => openDiff(target, change.path)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDiff(target, change.path);
        }
      }}
    />
  );
}
