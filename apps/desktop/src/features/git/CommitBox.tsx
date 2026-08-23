import { CommitBox as KitCommitBox } from "@apex/ui";
import { useState } from "preact/hooks";

import type { GitStatus } from "@/bindings/GitStatus";
import { commitStaged, gitFailure } from "@/features/git/state";
import { t } from "@/shared/i18n";

export function CommitBox({ status }: { status: GitStatus }) {
  const [message, setMessage] = useState("");
  const [landed, setLanded] = useState<string | null>(null);

  const staged = status.changes.filter((change) => change.staged);
  const ready = staged.length > 0 && message.trim().length > 0;
  const [subject] = message.split("\n");

  return (
    <KitCommitBox
      value={message}
      placeholder={t("git.messagePlaceholder")}
      submitLabel={t("git.commit")}
      submitDisabled={!ready}
      label={t("git.commit")}
      hint={
        landed
          ? t("git.committed", { commit: landed })
          : t("git.onBranch", { count: String(staged.length), branch: status.branch })
      }
      actions={
        subject.length > 50 ? (
          <span title={t("git.subjectLong")} class="shrink-0 tabular-nums text-git-behind">
            {subject.length}
          </span>
        ) : undefined
      }
      onInput={(event) => {
        setMessage(event.currentTarget.value);
        setLanded(null);
      }}
      onSubmit={() => {
        void commitStaged(message.trim())
          .then((created) => {
            setMessage("");
            setLanded(created.short);
          })
          .catch((error: unknown) => {
            gitFailure.value = String(error);
          });
      }}
    />
  );
}
