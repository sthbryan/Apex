import cn from "cnfast";
import { useState } from "preact/hooks";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { switchTo } from "@/features/projects/state";
import { SessionStateDot } from "@/features/sessions/SessionStateDot";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  sessions: SessionSummary[];
  projects: ProjectSummary[];
};

export function ElsewhereList({ sessions, projects }: Props) {
  const [open, setOpen] = useState(false);
  const waiting = sessions.filter((session) => session.state === "blocked").length;

  const grouped = new Map<string, SessionSummary[]>();
  for (const session of sessions) {
    const bucket = grouped.get(session.project_id) ?? [];
    bucket.push(session);
    grouped.set(session.project_id, bucket);
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        class="mb-1 flex w-full items-center gap-2 px-1 text-micro uppercase tracking-wider text-faint hover:text-muted"
      >
        <Icon
          name="chevron"
          size={12}
          class={cn("transition-transform", open ? "" : "-rotate-90")}
        />
        <span>{t("projects.elsewhere")}</span>
        <span class="ml-auto normal-case">
          {waiting > 0 ? <span class="text-state-blocked">{waiting}</span> : sessions.length}
        </span>
      </button>

      {open &&
        [...grouped.entries()].map(([projectId, group]) => (
          <div key={projectId} class="mb-2">
            <button
              type="button"
              onClick={() => void switchTo(projectId)}
              class="w-full truncate px-1 text-left text-faint hover:text-text"
            >
              {projects.find((project) => project.id === projectId)?.name ?? projectId.slice(0, 8)}
            </button>
            <ul class="flex flex-col">
              {group.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => void switchTo(session.project_id)}
                    class="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-muted hover:bg-raised"
                  >
                    <SessionStateDot session={session} />
                    <span class="truncate">{session.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
