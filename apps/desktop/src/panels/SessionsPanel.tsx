import type { SessionSummary } from "../bindings/SessionSummary";
import { t } from "../i18n";
import { closeSession } from "../sessions";
import { activeSessionId, dropSession, focusSession, openInNewTab } from "../shell/workspace";

type Props = {
  sessions: SessionSummary[];
};

const STATE_STYLES: Record<string, string> = {
  idle: "border border-state-idle",
  working: "bg-state-working",
  blocked: "bg-state-blocked",
  done: "bg-state-done",
};

export function SessionsPanel({ sessions }: Props) {
  const live = sessions.filter((session) => session.exit_code === null);
  const finished = sessions.filter((session) => session.exit_code !== null);

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-2">
      <section>
        <h2 class="mb-1 px-1 uppercase tracking-wider text-faint">{t("sessions.live")}</h2>
        {live.length === 0 ? (
          <p class="px-1 text-faint">{t("sessions.empty")}</p>
        ) : (
          <ul class="flex flex-col">
            {live.map((session) => (
              <Row key={session.id} session={session} />
            ))}
          </ul>
        )}
      </section>

      {finished.length > 0 && (
        <section>
          <div class="mb-1 flex items-center gap-2 px-1">
            <h2 class="uppercase tracking-wider text-faint">{t("sessions.finished")}</h2>
            <button
              type="button"
              title={t("sessions.clearFinished")}
              onClick={() => {
                for (const session of finished) {
                  dismiss(session.id);
                }
              }}
              class="ml-auto text-faint hover:text-text"
            >
              ×
            </button>
          </div>
          <ul class="flex flex-col">
            {finished.map((session) => (
              <Row key={session.id} session={session} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ session }: { session: SessionSummary }) {
  const finished = session.exit_code !== null;

  return (
    <li
      class={`group flex items-center gap-2 rounded px-1 hover:bg-raised ${
        activeSessionId.value === session.id ? "bg-raised" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (!focusSession(session.id)) {
            openInNewTab(session);
          }
        }}
        class={`flex min-w-0 flex-1 items-center gap-2 py-1 text-left ${
          finished ? "text-muted" : ""
        }`}
      >
        <span class={`size-2 shrink-0 rounded-full ${dotStyle(session)}`} />
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
        onClick={() => dismiss(session.id)}
        class="shrink-0 text-faint opacity-0 group-hover:opacity-100 hover:text-text"
      >
        ×
      </button>
    </li>
  );
}

function dotStyle(session: SessionSummary): string {
  if (session.exit_code !== null) {
    return session.exit_code === 0 ? "bg-state-done" : "bg-state-failed";
  }
  return STATE_STYLES[session.state] ?? STATE_STYLES.idle;
}

function dismiss(id: string): void {
  dropSession(id);
  void closeSession(id);
}
