import cn from "cnfast";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { requestClose } from "@/features/sessions/pending";
import { SessionStateDot } from "@/features/sessions/SessionStateDot";
import { activeSessionId, focusSession, openInNewTab } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  session: SessionSummary;
};

export function SessionRow({ session }: Props) {
  const finished = session.exit_code !== null;

  return (
    <li
      class={cn(
        "group flex animate-row-in items-center gap-2 rounded px-1 transition-colors hover:bg-raised",
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
        <SessionStateDot session={session} />
        <span class="truncate">{session.title}</span>
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
