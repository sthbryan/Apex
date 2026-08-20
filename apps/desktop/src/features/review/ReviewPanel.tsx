import cn from "cnfast";

import { PanelActions } from "@/app/layout/PanelActions";
import type { PendingReview } from "@/bindings/PendingReview";
import type { SessionState } from "@/bindings/SessionState";
import { gitTarget, pending, refreshPending, sameTarget } from "@/features/git/state";
import { activeProject } from "@/features/projects/state";
import { openReview } from "@/features/review/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const DOTS: Record<SessionState, string> = {
  done: "bg-state-done",
  blocked: "bg-state-blocked",
  working: "bg-state-working animate-pulse",
  idle: "bg-state-idle",
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
    <div class="flex h-full flex-col">
      <PanelActions>
        <button
          type="button"
          title={t("review.refresh")}
          onClick={() => void refreshPending()}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </PanelActions>

      {waiting.length === 0 ? (
        <p class="px-2 py-1 text-faint">{t("review.empty")}</p>
      ) : (
        <>
          <p class="px-2 py-1 text-faint">
            {t("review.waiting", { count: String(waiting.length) })}
          </p>
          <ul class="min-h-0 flex-1 overflow-auto pb-1">
            {waiting.map((review) => (
              <Row key={review.branch} review={review} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Row({ review }: { review: PendingReview }) {
  const here = sameTarget(gitTarget.value, review.target);
  return (
    <li>
      <button
        type="button"
        onClick={() => void openReview(review.target)}
        class={cn(
          "flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors hover:bg-raised",
          here ? "bg-raised text-text" : "text-muted",
        )}
      >
        <span
          class={cn(
            "size-1.5 shrink-0 rounded-full",
            review.state ? DOTS[review.state] : "bg-faint",
          )}
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate">{review.title ?? review.branch}</span>
        <span class="shrink-0 text-faint">
          {t("review.files", { count: String(review.files) })}
        </span>
        <span class="shrink-0 text-git-added">+{review.added}</span>
        <span class="shrink-0 text-git-removed">−{review.removed}</span>
      </button>
    </li>
  );
}
