import { useState } from "preact/hooks";

import type { GitStatus } from "@/bindings/GitStatus";
import { commitStaged, gitFailure } from "@/features/git/state";
import { t } from "@/shared/i18n";

export function CommitBox({ status }: { status: GitStatus }) {
  const [message, setMessage] = useState("");
  const [landed, setLanded] = useState<string | null>(null);

  const staged = status.changes.filter((change) => change.staged);
  const ready = staged.length > 0 && message.trim().length > 0;

  const commit = () => {
    if (!ready) {
      return;
    }
    void commitStaged(message.trim())
      .then((created) => {
        setMessage("");
        setLanded(created.short);
      })
      .catch((error: unknown) => {
        gitFailure.value = String(error);
      });
  };

  return (
    <div class="shrink-0 border-t border-border bg-surface mt-auto">
      <textarea
        rows={5}
        value={message}
        placeholder={t("git.messagePlaceholder")}
        spellcheck={false}
        onInput={(event) => {
          setMessage(event.currentTarget.value);
          setLanded(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            commit();
          }
        }}
        class="field-sizing-content max-h-56 min-h-20 w-full resize-none border-0 bg-transparent px-2 py-1.5 text-text outline-none placeholder:text-faint"
      />
      <div class="flex items-center gap-2 px-2 pb-1.5">
        <span class="min-w-0 flex-1 truncate text-faint">
          {landed
            ? t("git.committed", { commit: landed })
            : t("git.onBranch", { count: String(staged.length), branch: status.branch })}
        </span>
        <button
          type="button"
          disabled={!ready}
          onClick={commit}
          title={t("git.commitHint")}
          class="shrink-0 rounded border border-border px-2 py-0.5 text-muted transition-colors enabled:hover:bg-raised enabled:hover:text-text disabled:opacity-40"
        >
          {t("git.commit")}
        </button>
      </div>
    </div>
  );
}
