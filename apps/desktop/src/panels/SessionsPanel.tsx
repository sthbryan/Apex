import type { SessionSummary } from "../bindings/SessionSummary";
import { t } from "../i18n";
import { activeSessionId, focusSession, openInNewTab } from "../shell/workspace";

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
  return (
    <div class="flex h-full flex-col overflow-y-auto p-2">
      <h2 class="mb-1 px-1 uppercase tracking-wider text-faint">{t("sessions.live")}</h2>
      {sessions.length === 0 ? (
        <p class="px-1 text-faint">{t("sessions.empty")}</p>
      ) : (
        <ul class="flex flex-col">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => {
                  if (!focusSession(session.id)) {
                    openInNewTab(session);
                  }
                }}
                class={`flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-raised ${
                  activeSessionId.value === session.id ? "bg-raised" : ""
                }`}
              >
                <span
                  class={`size-2 shrink-0 rounded-full ${
                    STATE_STYLES[session.state] ?? STATE_STYLES.idle
                  }`}
                />
                <span class="truncate">{session.title}</span>
                {session.exit_code !== null && (
                  <span class="ml-auto shrink-0 text-faint">
                    {t("sessions.exited", { code: String(session.exit_code) })}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
