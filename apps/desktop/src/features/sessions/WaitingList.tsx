import { Dot, ListRow } from "@apex/ui";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { switchTo } from "@/features/projects/state";
import { focusSession } from "@/features/workspace/state";
import { t } from "@/shared/i18n";

type Props = {
  sessions: SessionSummary[];
  projects: ProjectSummary[];
};

export function WaitingList({ sessions, projects }: Props) {
  return (
    <section class="flex animate-pop-in flex-col gap-0.5 rounded border border-state-blocked/40 bg-state-blocked/5 p-1">
      <h2 class="px-1.5 pt-1 pb-1 text-xs font-semibold uppercase tracking-caps text-state-blocked">
        {t("sessions.waiting")}
      </h2>
      {sessions.map((session) => (
        <ListRow
          key={session.id}
          label={session.title}
          lead={<Dot state="blocked" />}
          trail={
            <span class="truncate">
              {projects.find((project) => project.id === session.project_id)?.name ?? ""}
            </span>
          }
          onClick={() => {
            if (!focusSession(session.id)) {
              void switchTo(session.project_id);
            }
          }}
        />
      ))}
    </section>
  );
}
