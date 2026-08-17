import cn from "cnfast";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { requestClose } from "@/features/sessions/pending";
import { SessionStateDot } from "@/features/sessions/SessionStateDot";
import { sessions } from "@/features/sessions/state";
import { activeSessionId, focusSession, openInNewTab } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  session: SessionSummary;
  depth?: number;
};

export function SessionRow({ session, depth = 0 }: Props) {
  const finished = session.exit_code !== null;
  const parent = sessions.value.find((candidate) => candidate.id === session.parent);

  return (
    <li
      class={cn(
        "group flex animate-row-in items-center gap-2 rounded px-1 transition-colors hover:bg-raised",
        depth > 0 && "mt-0.5 ml-3",
        activeSessionId.value === session.id ? "bg-raised" : "",
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (!focusSession(session.id)) {
            openInNewTab(session);
          }
        }}
        class={cn(
          "flex min-w-0 flex-1 items-center gap-2 py-1 text-left",
          finished ? "text-muted" : "",
        )}
      >
        {depth > 0 && <span class="w-2 shrink-0 border-l border-border" aria-hidden="true" />}
        <SessionStateDot session={session} />
        <AgentIcon agent={session.agent} class="shrink-0 text-faint" />
        <span class="min-w-0">
          <span
            class="block truncate"
            title={parent ? t("sessions.spawnedBy", { agent: parent.title }) : session.title}
          >
            {session.title}
          </span>
          <span class="block truncate text-micro text-faint">{detailOf(session)}</span>
        </span>
        {finished && (
          <span class="ml-auto shrink-0 text-faint">
            {t("sessions.exited", { code: String(session.exit_code) })}
          </span>
        )}
      </button>
      <button
        type="button"
        title={finished ? t("sessions.dismiss") : t("sessions.close")}
        onClick={() => requestClose(session)}
        class="shrink-0 text-faint opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-text"
      >
        <Icon name="close" size={12} />
      </button>
    </li>
  );
}

function detailOf(session: SessionSummary): string {
  if (session.worktree) {
    return `${session.worktree.branch} · ${session.worktree.path}`;
  }
  return session.cwd;
}
