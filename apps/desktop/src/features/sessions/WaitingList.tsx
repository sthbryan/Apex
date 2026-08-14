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
    <section class="animate-pop-in rounded border border-state-blocked/40 bg-state-blocked/5 p-1">
      <h2 class="mb-1 px-1 uppercase tracking-wider text-state-blocked">{t("sessions.waiting")}</h2>
      <ul class="flex flex-col">
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              onClick={() => {
                if (!focusSession(session.id)) {
                  void switchTo(session.project_id);
                }
              }}
              class="flex w-full items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-raised"
            >
              <span class="size-2 shrink-0 rounded-full bg-state-blocked" />
              <span class="truncate">{session.title}</span>
              <span class="ml-auto shrink-0 truncate text-faint">
                {projects.find((project) => project.id === session.project_id)?.name ?? ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
