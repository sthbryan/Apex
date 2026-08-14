import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { highlight } from "@/features/files/highlight";
import { gitStatus, readDiff } from "@/features/git/state";
import { sessions } from "@/features/sessions/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  sessionId: string | null;
  path: string;
};

export function DiffView({ sessionId, path }: Props) {
  const [markup, setMarkup] = useState<string | null>(null);
  const [patch, setPatch] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const ticket = useRef(0);

  const session = sessions.value.find((candidate) => candidate.id === sessionId);
  const label = session?.worktree?.branch ?? session?.title ?? gitStatus.value?.branch ?? "";

  const load = useCallback(() => {
    const mine = ++ticket.current;
    setPatch(null);
    setFailure(null);

    void readDiff(sessionId, path)
      .then(async (text) => {
        const painted = text ? await highlight("patch.diff", text) : null;
        if (mine === ticket.current) {
          setPatch(text);
          setMarkup(painted);
        }
      })
      .catch((error: unknown) => {
        if (mine === ticket.current) {
          setFailure(String(error));
        }
      });
  }, [sessionId, path]);

  useEffect(load, [load]);

  return (
    <div class="flex h-full flex-col bg-bg">
      <header class="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2">
        <Icon name="branch" size={12} />
        <span class="truncate text-text">{path}</span>
        <span class="truncate text-faint">{label}</span>
        <button
          type="button"
          title={t("git.reload")}
          onClick={load}
          class="ml-auto shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </header>

      {failure && <p class="p-3 text-state-failed">{failure}</p>}

      {patch !== null && patch.trim() === "" && <p class="p-3 text-faint">{t("git.noDiff")}</p>}

      {patch !== null && patch.trim() !== "" && (
        <div class="min-h-0 flex-1 overflow-auto">
          <pre class="w-max min-w-full animate-veil-in px-3 py-2 leading-5">
            {markup ? <code dangerouslySetInnerHTML={{ __html: markup }} /> : <code>{patch}</code>}
          </pre>
        </div>
      )}
    </div>
  );
}
