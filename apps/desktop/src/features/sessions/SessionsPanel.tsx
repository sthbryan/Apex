import cn from "cnfast";
import { Fragment } from "preact";
import { useState } from "preact/hooks";
import { revealPanel } from "@/app/layout/actions";
import { PanelHeader } from "@/app/layout/PanelHeader";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { selectTarget, sessionOfWorktree, worktrees } from "@/features/git/state";
import { waiting } from "@/features/notifications/state";
import {
  activeProject,
  foreignSessions,
  projectSessions,
  projects,
} from "@/features/projects/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { ElsewhereList } from "@/features/sessions/ElsewhereList";
import { requestClose, requestSession } from "@/features/sessions/pending";
import { SessionRow } from "@/features/sessions/SessionRow";
import { sessions as allSessions } from "@/features/sessions/state";
import { WaitingList } from "@/features/sessions/WaitingList";
import { installedAgents } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function SessionsPanel() {
  const sessions = projectSessions.value;
  const elsewhere = foreignSessions.value;
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

        <OrphanTrees />

        {elsewhere.length > 0 && <ElsewhereList sessions={elsewhere} projects={projects.value} />}
      </div>
    </div>
  );
}

function StartHere() {
  const project = activeProject.value;
  const offered = byRecentUse(installedAgents.value);

  if (!project) {
    return <p class="px-1 text-faint">{t("sessions.empty")}</p>;
  }

  return (
    <div class="flex flex-col">
      <h2 class="mb-1 px-1 text-micro uppercase tracking-wider text-faint">
        {t("sessions.startTitle")}
      </h2>
      <ul class="flex flex-col">
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
              class="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-muted transition-colors hover:bg-raised hover:text-text"
            >
              <AgentIcon agent={agent.name} class="shrink-0" />
              <span class="truncate">{agent.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function byRecentUse<T extends { name: string }>(agents: readonly T[]): T[] {
  const lastUsed = new Map<string, number>();
  for (const session of allSessions.value) {
    const seen = lastUsed.get(session.agent) ?? 0;
    if (session.started_at > seen) {
      lastUsed.set(session.agent, session.started_at);
    }
  }
  return [...agents].sort((left, right) => {
    const gap = (lastUsed.get(right.name) ?? 0) - (lastUsed.get(left.name) ?? 0);
    return gap !== 0 ? gap : left.name.localeCompare(right.name);
  });
}

function OrphanTrees() {
  const owners = sessionOfWorktree.value;
  const orphans = worktrees.value.filter((tree) => !owners.has(tree.path));
  if (orphans.length === 0) {
    return null;
  }

  return (
    <section class="mt-2">
      <div class="mb-1 flex items-center gap-2 px-1">
        <span class="size-1.5 shrink-0 rounded-full bg-state-idle" aria-hidden="true" />
        <h2 class="text-micro uppercase tracking-wider text-faint">
          {t("sessions.looseTrees")} · {orphans.length}
        </h2>
      </div>
      <ul class="flex flex-col">
        {orphans.map((tree) => (
          <li key={tree.path}>
            <button
              type="button"
              title={tree.path}
              onClick={() => {
                selectTarget({ type: "worktree", path: tree.path });
                revealPanel("git");
              }}
              class="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-muted transition-colors hover:bg-raised hover:text-text"
            >
              <Icon name="branch" size={13} class="shrink-0 text-faint" />
              <span class="min-w-0 flex-1 truncate">{tree.branch}</span>
              {tree.changed > 0 && (
                <span class="shrink-0 text-micro tabular-nums text-git-dirty">{tree.changed}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
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
