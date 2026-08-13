import type { AgentSummary } from "../bindings/AgentSummary";
import type { SessionSummary } from "../bindings/SessionSummary";
import { t } from "../i18n";
import { createSession } from "../sessions";
import { activeSessionId, focusSession, openInNewTab } from "../shell/workspace";

type Props = {
  sessions: SessionSummary[];
  agents: AgentSummary[];
};

const STATE_STYLES: Record<string, string> = {
  idle: "border border-state-idle",
  working: "bg-state-working",
  blocked: "bg-state-blocked",
  done: "bg-state-done",
};

export function SessionsPanel({ sessions, agents }: Props) {
  const available = agents.filter((agent) => agent.resolved_path !== null);

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-2">
      <section>
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
      </section>

      <section>
        <h2 class="mb-1 px-1 uppercase tracking-wider text-faint">{t("dock.agents")}</h2>
        <ul class="flex flex-col">
          {available.map((agent) => (
            <li key={agent.name}>
              <button
                type="button"
                onClick={() => {
                  void createSession(agent.name, { rows: 24, cols: 80 }).then(openInNewTab);
                }}
                class="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-muted hover:bg-raised hover:text-text"
              >
                <span class="text-faint">+</span>
                <span class="truncate">{agent.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
