import { revealPanel } from "@/app/layout/actions";
import { gitStatus } from "@/features/git/state";
import { TargetChip } from "@/features/git/TargetChip";
import { activeProject } from "@/features/projects/state";
import { t } from "@/shared/i18n";

export function GitChip() {
  const project = activeProject.value;
  const status = gitStatus.value;
  if (!project?.is_git || !status) {
    return <div />;
  }

  const dirty = status.changes.length;

  return (
    <div class="flex min-w-0 items-center gap-2">
      <TargetChip project={project} placement="above" />
      {dirty > 0 && (
        <button
          type="button"
          title={t("git.openChanges")}
          onClick={() => revealPanel("git")}
          class="shrink-0 tabular-nums text-git-dirty transition-colors hover:text-text"
        >
          {t("git.changed", { count: String(dirty) })}
        </button>
      )}
      {status.ahead > 0 && (
        <span
          title={t("git.ahead", { count: String(status.ahead) })}
          class="shrink-0 tabular-nums text-git-ahead"
        >
          ↑{status.ahead}
        </span>
      )}
      {status.behind > 0 && (
        <span
          title={t("git.behind", { count: String(status.behind) })}
          class="shrink-0 tabular-nums text-git-behind"
        >
          ↓{status.behind}
        </span>
      )}
    </div>
  );
}
