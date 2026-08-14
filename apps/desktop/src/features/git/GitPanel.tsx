import cn from "cnfast";
import { useCallback, useEffect, useState } from "preact/hooks";

import type { GitChange } from "@/bindings/GitChange";
import type { GitStatus } from "@/bindings/GitStatus";
import type { MergeReport } from "@/bindings/MergeReport";
import { mergeWorktree, readStatus } from "@/features/git/state";
import { sessions } from "@/features/sessions/state";
import { activeSessionId, openDiff } from "@/features/workspace/state";
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
  const sessionId = activeSessionId.value;
  const session = sessions.value.find((candidate) => candidate.id === sessionId);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [report, setReport] = useState<MergeReport | null>(null);

  const refresh = useCallback(() => {
    if (!sessionId) {
      setStatus(null);
      return;
    }
    void readStatus(sessionId)
      .then((next) => {
        setStatus(next);
        setFailure(null);
      })
      .catch((error: unknown) => {
        setStatus(null);
        setFailure(String(error));
      });
  }, [sessionId]);

  useEffect(refresh, [refresh]);

  if (!sessionId) {
    return <p class="p-2 text-faint">{t("git.noSession")}</p>;
  }

  return (
    <div class="flex h-full flex-col">
      <div class="flex shrink-0 items-center gap-2 px-2 py-1">
        <Icon name="branch" size={12} class="shrink-0 text-faint" />
        <h2 class="truncate text-muted">{status?.branch ?? session?.title ?? ""}</h2>
        <button
          type="button"
          title={t("git.refresh")}
          onClick={refresh}
          class="ml-auto shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </div>

      {failure && <p class="px-2 text-state-failed">{failure}</p>}

      {status && status.changes.length === 0 && <p class="px-2 text-faint">{t("git.clean")}</p>}

      <ul class="min-h-0 flex-1 overflow-auto">
        {status?.changes.map((change) => (
          <Row key={change.path} change={change} sessionId={sessionId} />
        ))}
      </ul>

      {status?.isolated && (
        <div class="shrink-0 border-t border-border p-2">
          <button
            type="button"
            onClick={() => {
              setReport(null);
              void mergeWorktree(sessionId)
                .then(setReport)
                .catch((error: unknown) => setFailure(String(error)));
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

function Row({ change, sessionId }: { change: GitChange; sessionId: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => openDiff(sessionId, change.path)}
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
