import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { waiting } from "@/features/notifications/state";
import { ElsewhereList } from "@/features/sessions/ElsewhereList";
import { SessionRow } from "@/features/sessions/SessionRow";
import { closeSession } from "@/features/sessions/state";
import { WaitingList } from "@/features/sessions/WaitingList";
import { dropSession } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  sessions: SessionSummary[];
  elsewhere: SessionSummary[];
  projects: ProjectSummary[];
};

export function SessionsPanel({ sessions, elsewhere, projects }: Props) {
  const live = sessions.filter((session) => session.exit_code === null);
  const finished = sessions.filter((session) => session.exit_code !== null);

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-2">
      {waiting.value.length > 0 && <WaitingList sessions={waiting.value} projects={projects} />}

      <section>
        <h2 class="mb-1 px-1 uppercase tracking-wider text-faint">{t("sessions.live")}</h2>
        {live.length === 0 ? (
          <p class="px-1 text-faint">{t("sessions.empty")}</p>
        ) : (
          <ul class="flex flex-col">
            {live.map((session) => (
              <SessionRow key={session.id} session={session} />
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
              class="ml-auto text-faint transition-colors hover:text-text"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
          <ul class="flex flex-col">
            {finished.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        </section>
      )}

      {elsewhere.length > 0 && <ElsewhereList sessions={elsewhere} projects={projects} />}
    </div>
  );
}

function dismiss(id: string): void {
  dropSession(id);
  void closeSession(id);
}
