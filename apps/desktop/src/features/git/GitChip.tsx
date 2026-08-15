import cn from "cnfast";
import { revealPanel } from "@/app/layout/actions";
import { gitStatus, worktrees } from "@/features/git/state";
import { activeProject } from "@/features/projects/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function GitChip() {
  const project = activeProject.value;
  const status = gitStatus.value;
  if (!project?.is_git || !status) {
    return <div />;
  }

  const trees = worktrees.value.length;
  const dirty = status.changes.length;

  const onOpen = () => revealPanel("git");

  return (
    <button
      type="button"
      onClick={onOpen}
      title={
        status.upstream
          ? t("git.chipTracking", { branch: status.branch, upstream: status.upstream })
          : t("git.chip", { branch: status.branch })
      }
      class="flex items-center gap-1.5 transition-colors hover:text-text"
    >
      <Icon name="branch" size={12} />
      <span class={cn("truncate", status.isolated ? "text-state-working" : "")}>
        {status.branch}
      </span>
      {dirty > 0 && <span class="text-state-blocked">{dirty}±</span>}
      {status.ahead > 0 && <span class="text-state-done">↑{status.ahead}</span>}
      {status.behind > 0 && <span class="text-state-working">↓{status.behind}</span>}
      {trees > 0 && (
        <span class="flex items-center gap-0.5">
          <span class="text-border">·</span>
          {t("git.trees", { count: String(trees) })}
        </span>
      )}
    </button>
  );
}
