import { Dot, ListRow } from "@apex/ui";
import cn from "cnfast";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { stateOf } from "@/features/sessions/dot";
import { requestClose } from "@/features/sessions/pending";
import { sessions } from "@/features/sessions/state";
import { mutedSessions, setMuted } from "@/features/settings/agentMode";
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
  const muted = mutedSessions.value.includes(session.id);
  const open = () => {
    if (!focusSession(session.id)) {
      openInNewTab(session);
    }
  };

  return (
    <li class={cn("relative flex animate-row-in", depth > 0 && "ml-3 border-l border-border pl-2")}>
      {overLimit && (
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-full bg-state-failed"
        />
      )}
      <ListRow
        as="div"
        role="button"
        tabIndex={0}
        class={cn("group flex-1", finished && "text-muted", overLimit && "text-state-failed")}
        title={parent ? t("sessions.spawnedBy", { agent: parent.title }) : session.cwd}
        label={session.title}
        sub={session.worktree?.branch}
        selected={activeSessionId.value === session.id}
        lead={
          <>
            <Dot state={stateOf(session)} />
            <AgentIcon agent={session.agent} size="sm" class="text-faint" />
          </>
        }
        trail={
          <>
            {muted && <Icon name="bellOff" size={12} class="text-faint group-hover:hidden" />}
            <span class="tabular-nums">
              {finished ? t("sessions.exited", { code: String(session.exit_code) }) : ago}
            </span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              title={muted ? t("notify.unmute") : t("notify.mute")}
              onClick={() => setMuted(session.id, !muted)}
              class="text-faint transition-colors hover:text-text"
            >
              <Icon name={muted ? "bellOff" : "bell"} size={12} />
            </button>
            <button
              type="button"
              title={finished ? t("sessions.dismiss") : t("sessions.close")}
              onClick={() => requestClose(session)}
              class="text-faint transition-colors hover:text-text"
            >
              <Icon name="close" size={12} />
            </button>
          </>
        }
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        }}
      />
    </li>
  );
}
