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
    <div class="shrink-0 border-t border-border p-2">
      <input
        type="text"
        value={message}
        placeholder={t("git.messagePlaceholder")}
        autocomplete="off"
        spellcheck={false}
        onInput={(event) => {
          setMessage(event.currentTarget.value);
          setLanded(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        class="w-full rounded border border-border bg-raised px-2 py-1 text-text outline-none placeholder:text-faint focus:border-muted"
      />
      <button
        type="button"
        disabled={!ready}
        onClick={commit}
        class="mt-1 w-full truncate rounded border border-border py-1 text-muted transition-colors enabled:hover:bg-raised enabled:hover:text-text disabled:opacity-50"
      >
        {t("git.commit", { count: String(staged.length), branch: status.branch })}
      </button>
      {landed && <p class="mt-1 text-state-done">{t("git.committed", { commit: landed })}</p>}
    </div>
  );
}
