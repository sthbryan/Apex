import { DiffStat, Dot, ListRow, SectionLabel } from "@apex/ui";
import { useEffect, useState } from "preact/hooks";

import { PanelActions } from "@/app/layout/PanelActions";
import type { MergeReport } from "@/bindings/MergeReport";
import type { PendingReview } from "@/bindings/PendingReview";
import type { SessionState } from "@/bindings/SessionState";
import { CommitBox } from "@/features/git/CommitBox";
import {
  clearRejects,
  gitFailure,
  gitStatus,
  gitTarget,
  mergeWorktree,
  pending,
  readRejects,
  refreshGit,
  refreshPending,
  sameTarget,
} from "@/features/git/state";
import { activeProject } from "@/features/projects/state";
import { openReview, rejectTarget, reviewing } from "@/features/review/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const STATES: Record<SessionState, "done" | "blocked" | "working" | "idle"> = {
  done: "done",
  blocked: "blocked",
  working: "working",
  idle: "idle",
};

export function ReviewPanel() {
  const project = activeProject.value;
  const waiting = pending.value;

  if (!project) {
    return <p class="p-2 text-faint">{t("files.noProject")}</p>;
  }
  if (!project.is_git) {
    return <p class="p-2 text-faint">{t("git.noRepo")}</p>;
  }

  return (
    <div class="dock-view dock-fixed">
      <div class="dock-scroll">
        <SectionLabel
          flush
          count={waiting.length || undefined}
          action={
            <PanelActions panel="review">
              <button
                type="button"
                title={t("review.refresh")}
                onClick={() => void refreshPending()}
                class="shrink-0 text-faint transition-colors hover:text-text"
              >
                <Icon name="refresh" size={12} />
              </button>
            </PanelActions>
          }
        >
          {t("review.waiting")}
        </SectionLabel>
        {waiting.length === 0 ? (
          <p class="px-1.5 py-1 text-faint">{t("review.empty")}</p>
        ) : (
          waiting.map((review) => <Row key={review.branch} review={review} />)
        )}
      </div>

      <Closing />
    </div>
  );
}

function Closing() {
  const [report, setReport] = useState<MergeReport | null>(null);
  const [shelved, setShelved] = useState(0);
  const [asking, setAsking] = useState(false);
  const at = reviewing.value;
  const status = gitStatus.value;
  const mine = at && sameTarget(gitTarget.value, at);

  useEffect(() => {
    if (!at || !mine) {
      setShelved(0);
      return;
    }
    void readRejects(at)
      .then((found) => setShelved(found.length))
      .catch(() => setShelved(0));
  }, [at, mine, status]);

  if (!at || !status || !mine) {
    return null;
  }

  const merge = () => {
    setAsking(false);
    setReport(null);
    void mergeWorktree(at)
      .then(async (outcome) => {
        setReport(outcome);
        if (outcome.type === "merged") {
          await clearRejects(at).catch(() => {});
          reviewing.value = null;
        }
        await refreshGit();
        await refreshPending();
      })
      .catch((error: unknown) => {
        gitFailure.value = String(error);
      });
  };

  const staged = status.changes.filter((change) => change.staged).length;
  if (staged === 0 && !status.isolated) {
    return null;
  }

  return (
    <>
      <CommitBox status={status} />
      {status.isolated && (
        <div class="shrink-0 border-t border-border p-2">
          {status.changes.length > 0 ? (
            <p class="text-faint">{t("review.commitFirst")}</p>
          ) : asking ? (
            <>
              <p class="mb-1 text-state-failed">
                {t("review.mergeDropsRejects", { count: String(shelved) })}
              </p>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={merge}
                  class="flex-1 rounded border border-border py-1 text-state-failed transition-colors hover:bg-raised hover:text-text"
                >
                  {t("review.mergeAnyway")}
                </button>
                <button
                  type="button"
                  onClick={() => setAsking(false)}
                  class="flex-1 rounded border border-border py-1 text-faint transition-colors hover:bg-raised hover:text-text"
                >
                  {t("review.clearNo")}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => (shelved > 0 ? setAsking(true) : merge())}
              class="w-full rounded border border-border py-1 text-muted transition-colors hover:bg-raised hover:text-text"
            >
              {t("git.merge", { base: status.base })}
            </button>
          )}
          {report?.type === "merged" && <p class="mt-1 text-git-added">{t("git.merged")}</p>}
          {report?.type === "conflicted" && (
            <p class="mt-1 text-git-conflict">
              {t("git.conflicted", { files: report.files.join(", ") })}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Row({ review }: { review: PendingReview }) {
  const here = sameTarget(gitTarget.value, review.target);
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <div class="flex items-center gap-2 px-1.5 py-1">
        <span class="min-w-0 flex-1 truncate text-state-failed">{t("review.rejectAllAsk")}</span>
        <button
          type="button"
          onClick={() => {
            setAsking(false);
            void rejectTarget(review.target);
          }}
          class="shrink-0 text-state-failed transition-colors hover:text-text"
        >
          {t("review.rejectAllYes")}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          {t("review.rejectAllNo")}
        </button>
      </div>
    );
  }

  return (
    <ListRow
      as="div"
      role="button"
      tabIndex={0}
      label={review.title ?? review.branch}
      title={review.branch}
      selected={here}
      lead={<Dot state={review.state ? STATES[review.state] : "idle"} />}
      trail={
        <>
          <span>{t("review.files", { count: String(review.files) })}</span>
          <DiffStat added={review.added} removed={review.removed} />
        </>
      }
      actions={
        <button
          type="button"
          title={t("review.rejectAll")}
          onClick={() => setAsking(true)}
          class="text-faint transition-colors hover:text-state-failed"
        >
          <Icon name="close" size={12} />
        </button>
      }
      onClick={() => void openReview(review.target)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void openReview(review.target);
        }
      }}
    />
  );
}
