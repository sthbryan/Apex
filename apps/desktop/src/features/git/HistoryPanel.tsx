import { useEffect } from "preact/hooks";

import { PanelActions } from "@/app/layout/PanelActions";
import type { GitTarget } from "@/bindings/GitTarget";
import { commits, gitFailure, gitTarget, readLog, since } from "@/features/git/state";
import { activeProject } from "@/features/projects/state";
import { openDiff } from "@/features/workspace/state";
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
    <div class="flex h-full flex-col">
      <PanelActions>
        <button
          type="button"
          title={t("git.refresh")}
          onClick={() => void readLog()}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </PanelActions>

      {gitFailure.value && <p class="px-2 py-1 text-state-failed">{gitFailure.value}</p>}

      <History target={target} />
    </div>
  );
}

function History({ target }: { target: GitTarget }) {
  if (commits.value.length === 0) {
    return <p class="px-2 py-1 text-faint">{t("git.noHistory")}</p>;
  }
  return (
    <ul class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1">
      {commits.value.map((commit) => (
        <li key={commit.id}>
          <button
            type="button"
            onClick={() => openDiff(target, "", commit.id)}
            class="flex w-full flex-col gap-0.5 px-2 py-1 text-left transition-colors hover:bg-raised"
          >
            <span class="flex w-full items-baseline gap-2">
              <span class="min-w-0 truncate text-muted" title={commit.summary}>
                {commit.summary}
              </span>
              <span class="ml-auto shrink-0 tabular-nums text-faint">{since(commit.when)}</span>
            </span>
            <span class="flex w-full items-baseline gap-2 text-faint">
              <span class="shrink-0 font-mono tabular-nums">{commit.short}</span>
              <span class="min-w-0 truncate" title={commit.author}>
                {commit.author}
              </span>
              {commit.refs && (
                <span class="ml-auto min-w-0 truncate text-accent" title={commit.refs}>
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
