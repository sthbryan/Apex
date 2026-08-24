import { ListRow, SectionLabel } from "@apex/ui";
import cn from "cnfast";
import { useEffect } from "preact/hooks";

import { PanelActions } from "@/app/layout/PanelActions";
import type { GitTarget } from "@/bindings/GitTarget";
import { commits, gitFailure, gitStatus, gitTarget, readLog, since } from "@/features/git/state";
import { activeProject } from "@/features/projects/state";
import { activeCommit, openDiff } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function HistoryPanel() {
  const project = activeProject.value;
  const target = gitTarget.value;

  useEffect(() => {
    void readLog();
  }, []);

  if (!project) {
    return <p class="p-2 text-faint">{t("files.noProject")}</p>;
  }
  if (!project.is_git) {
    return <p class="p-2 text-faint">{t("git.noRepo")}</p>;
  }

  return (
    <div class="dock-view">
      <SectionLabel
        flush
        action={
          <PanelActions panel="history">
            <button
              type="button"
              title={t("git.refresh")}
              onClick={() => void readLog()}
              class="shrink-0 text-faint transition-colors hover:text-text"
            >
              <Icon name="refresh" size={12} />
            </button>
          </PanelActions>
        }
      >
        {t("git.recent", { branch: gitStatus.value?.branch ?? "" })}
      </SectionLabel>

      {gitFailure.value && <p class="px-1.5 text-state-failed">{gitFailure.value}</p>}

      <History target={target} />
    </div>
  );
}

function History({ target }: { target: GitTarget }) {
  if (commits.value.length === 0) {
    return <p class="px-1.5 py-1 text-faint">{t("git.noHistory")}</p>;
  }
  const viewing = activeCommit.value;

  return (
    <>
      {commits.value.map((commit) => {
        const open = commit.id === viewing;
        return (
          <ListRow
            key={commit.id}
            label={commit.summary}
            title={commit.summary}
            selected={open}
            class={cn("border-l-2", open ? "border-l-accent" : "border-l-transparent")}
            lead={<span class="font-mono tabular-nums text-faint">{commit.short}</span>}
            sub={
              <>
                <span class="truncate" title={commit.author}>
                  {commit.author}
                </span>
                {commit.refs && (
                  <span class="ml-auto truncate text-accent" title={commit.refs}>
                    {commit.refs.split(", ")[0]}
                  </span>
                )}
              </>
            }
            trail={<span class="tabular-nums">{since(commit.when)}</span>}
            onClick={() => openDiff(target, "", commit.id)}
          />
        );
      })}
    </>
  );
}
