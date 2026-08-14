import { waiting } from "@/features/notifications/state";
import { foreignSessions, projectSessions, projects } from "@/features/projects/state";
import { ElsewhereList } from "@/features/sessions/ElsewhereList";
import { requestClose } from "@/features/sessions/pending";
import { SessionRow } from "@/features/sessions/SessionRow";
import { WaitingList } from "@/features/sessions/WaitingList";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function SessionsPanel() {
  const sessions = projectSessions.value;
  const elsewhere = foreignSessions.value;
  const live = sessions.filter((session) => session.exit_code === null);
  const finished = sessions.filter((session) => session.exit_code !== null);

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-2">
      {waiting.value.length > 0 && (
        <WaitingList sessions={waiting.value} projects={projects.value} />
      )}

      <section>
        <h2 class="mb-1 px-1 text-micro uppercase tracking-wider text-faint">
          {t("sessions.live")}
        </h2>
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
            <h2 class="text-micro uppercase tracking-wider text-faint">{t("sessions.finished")}</h2>
            <button
              type="button"
              title={t("sessions.clearFinished")}
              onClick={() => {
                for (const session of finished) {
                  requestClose(session);
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

      {elsewhere.length > 0 && <ElsewhereList sessions={elsewhere} projects={projects.value} />}
    </div>
  );
}
