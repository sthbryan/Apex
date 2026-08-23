import { Dot, ListRow } from "@apex/ui";
import cn from "cnfast";
import { useState } from "preact/hooks";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { revealSession, switchTo } from "@/features/projects/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { stateOf } from "@/features/sessions/dot";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  sessions: SessionSummary[];
  projects: ProjectSummary[];
};

export function ElsewhereList({ sessions, projects }: Props) {
  const [open, setOpen] = useState(true);
  const waiting = sessions.filter((session) => session.state === "blocked").length;

  const grouped = new Map<string, SessionSummary[]>();
  for (const session of sessions) {
    const bucket = grouped.get(session.project_id) ?? [];
    bucket.push(session);
    grouped.set(session.project_id, bucket);
  }

  return (
    <section class="mt-2 flex flex-col gap-0.5 border-t border-border pt-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((shown) => !shown)}
        class="flex w-full items-center gap-1.5 px-1.5 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-caps text-muted hover:text-text"
      >
        <Icon
          name="chevron"
          size={12}
          class={cn("transition-transform", open ? "" : "-rotate-90")}
        />
        <span>{t("projects.elsewhere")}</span>
        <span class="ml-auto font-normal normal-case">
          {waiting > 0 ? <span class="text-state-blocked">{waiting}</span> : sessions.length}
        </span>
      </button>

      {open &&
        [...grouped.entries()].map(([projectId, group]) => (
          <div key={projectId} class="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => void switchTo(projectId)}
              class="truncate px-1.5 pt-1 text-left text-xs text-faint hover:text-text"
            >
              {projects.find((project) => project.id === projectId)?.name ?? projectId.slice(0, 8)}
            </button>
            {group.map((session) => (
              <ListRow
                key={session.id}
                label={session.title}
                class="text-muted"
                lead={
                  <>
                    <Dot state={stateOf(session)} class="opacity-50" />
                    <AgentIcon agent={session.agent} size="sm" class="text-faint" />
                  </>
                }
                onClick={() => void revealSession(session)}
              />
            ))}
          </div>
        ))}
    </section>
  );
}
