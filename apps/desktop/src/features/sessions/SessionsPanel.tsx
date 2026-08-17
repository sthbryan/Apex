import cn from "cnfast";
import { Fragment } from "preact";
import { useState } from "preact/hooks";
import { PanelHeader } from "@/app/layout/PanelHeader";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { waiting } from "@/features/notifications/state";
import { activeProject, projectSessions, projects } from "@/features/projects/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { requestClose, requestSession } from "@/features/sessions/pending";
import { SessionRow } from "@/features/sessions/SessionRow";
import { WaitingList } from "@/features/sessions/WaitingList";
import { installedAgents } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const OFFERED_AGENTS = 3;

export function SessionsPanel() {
  const sessions = projectSessions.value;
  const live = sessions.filter((session) => session.exit_code === null);
  const finished = sessions.filter((session) => session.exit_code !== null);
  const hasSessions = live.length > 0 || finished.length > 0;

  return (
    <div class="flex h-full flex-col">
      <PanelHeader title={t("dock.sessions")} />
      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        {waiting.value.length > 0 && (
          <WaitingList sessions={waiting.value} projects={projects.value} />
        )}

        {!hasSessions && <StartHere />}

        {live.length > 0 && (
          <section class="mb-2">
            <div class="mb-1 flex items-center gap-2 px-1">
              <span
                class="size-1.5 shrink-0 animate-pulse rounded-full bg-state-working"
                aria-hidden="true"
              />
              <h2 class="text-micro uppercase tracking-wider text-faint">
                {t("sessions.running")} · {live.length}
              </h2>
            </div>
            <ul class="flex flex-col">{renderTree(live)}</ul>
          </section>
        )}

        {finished.length > 0 && (
          <section>
            <div class="mb-1 flex items-center gap-2 px-1">
              <span class="size-1.5 shrink-0 rounded-full bg-state-done" aria-hidden="true" />
              <h2 class="text-micro uppercase tracking-wider text-faint">
                {t("sessions.finished")} · {finished.length}
              </h2>
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
            <ul class="flex flex-col">{renderTree(finished)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}

function StartHere() {
  const project = activeProject.value;
  const offered = installedAgents.value.slice(0, OFFERED_AGENTS);

  return (
    <div class="flex flex-col gap-2">
      <p class="px-1 text-faint">{t("sessions.empty")}</p>
      {project && (
        <ul class="flex flex-col gap-1">
          {offered.map((agent) => (
            <li key={agent.name}>
              <button
                type="button"
                onClick={() =>
                  requestSession({
                    project: project.id,
                    agent: agent.name,
                    direction: null,
                    isGit: project.is_git,
                  })
                }
                class="flex w-full items-center gap-2 rounded border border-border bg-raised px-2 py-1.5 text-left transition-colors hover:border-muted"
              >
                <AgentIcon agent={agent.name} class="shrink-0 text-faint" />
                <span class="truncate">{t("sessions.startWith", { agent: agent.name })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderTree(sessions: SessionSummary[]) {
  const { roots, byParent } = treeOf(sessions);
  return roots.map((session) => <Branch key={session.id} session={session} byParent={byParent} />);
}

function treeOf(sessions: SessionSummary[]) {
  const byParent = new Map<string, SessionSummary[]>();
  const ids = new Set(sessions.map((session) => session.id));
  for (const session of sessions) {
    if (session.parent && ids.has(session.parent)) {
      const list = byParent.get(session.parent) ?? [];
      list.push(session);
      byParent.set(session.parent, list);
    }
  }
  const roots = sessions.filter((session) => !(session.parent && byParent.has(session.parent)));
  return { roots, byParent };
}

type BranchProps = {
  session: SessionSummary;
  byParent: Map<string, SessionSummary[]>;
  depth?: number;
};

function Branch({ session, byParent, depth = 0 }: BranchProps) {
  const [open, setOpen] = useState(true);
  const children = byParent.get(session.id) ?? [];

  return (
    <Fragment>
      <SessionRow session={session} depth={depth} />
      {children.length > 0 && (
        <li class="flex">
          <button
            type="button"
            onClick={() => setOpen((shown) => !shown)}
            class="ml-3 flex items-center gap-1 py-0.5 pl-2 text-micro text-faint transition-colors hover:text-text"
          >
            <Icon
              name="chevron"
              size={11}
              class={cn("transition-transform", open ? "" : "-rotate-90")}
            />
            {t("sessions.spawned", { count: String(children.length) })}
          </button>
        </li>
      )}
      {open &&
        children.map((child) => (
          <Branch key={child.id} session={child} byParent={byParent} depth={depth + 1} />
        ))}
    </Fragment>
  );
}
