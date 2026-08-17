import cn from "cnfast";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { requestClose } from "@/features/sessions/pending";
import { SessionStateDot } from "@/features/sessions/SessionStateDot";
import { sessions } from "@/features/sessions/state";
import { countdown } from "@/features/usage/format";
import { activeSessionId, focusSession, openInNewTab } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { metrics } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  session: SessionSummary;
  depth?: number;
};

export function SessionRow({ session, depth = 0 }: Props) {
  const finished = session.exit_code !== null;
  const parent = sessions.value.find((candidate) => candidate.id === session.parent);
  const ago = countdown(Date.now() / 1000 - session.started_at) ?? t("sessions.justNow");
  const report = (metrics.value?.quotas ?? []).find((entry) => entry.agent === session.agent);
  const tight = report ? Math.max(0, ...report.windows.map((window) => window.used_percent)) : 0;
  const overLimit = tight >= 100;

  return (
    <li
      class={cn(
        "group relative flex animate-row-in items-center gap-2 rounded px-1 transition-colors hover:bg-raised",
        depth > 0 && "mt-0.5 ml-3",
        activeSessionId.value === session.id ? "bg-raised" : "",
      )}
    >
      {overLimit && (
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-full bg-state-failed"
        />
      )}
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
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-2">
            <SessionStateDot session={session} />
            <AgentIcon agent={session.agent} class="shrink-0 text-faint" />
            <span
              class={cn("truncate", overLimit && "text-state-failed")}
              title={parent ? t("sessions.spawnedBy", { agent: parent.title }) : session.title}
            >
              {session.title}
            </span>
          </div>
          <div class="truncate pl-[38px] text-micro text-faint">{session.cwd}</div>
          {session.worktree && (
            <div class="truncate pl-[38px] text-micro text-faint">{session.worktree.branch}</div>
          )}
          <div class="truncate pl-[38px] text-micro text-faint">
            {t("sessions.startedAgo", { ago })}
          </div>
        </div>
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
