import { StatusPill } from "@apex/ui";
import { revealPanel } from "@/app/layout/actions";
import { gitStatus } from "@/features/git/state";
import { TargetChip } from "@/features/git/TargetChip";
import { activeProject } from "@/features/projects/state";
import { t } from "@/shared/i18n";

export function GitChip() {
  const project = activeProject.value;
  const status = gitStatus.value;
  if (!project?.is_git || !status) {
    return null;
  }

  const dirty = status.changes.length;

  return (
    <>
      <TargetChip project={project} placement="above" />
      {dirty > 0 && (
        <StatusPill title={t("git.openChanges")} onClick={() => revealPanel("git")}>
          <span class="font-mono tabular-nums text-git-dirty">{dirty}</span>
          {t("git.changedWord")}
        </StatusPill>
      )}
    </>
  );
}
