import { ListRow, SectionLabel } from "@apex/ui";
import cn from "cnfast";
import { Fragment } from "preact";
import { useState } from "preact/hooks";
import { revealPanel } from "@/app/layout/actions";
import { PanelActions } from "@/app/layout/PanelActions";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { selectTarget, sessionOfWorktree, worktrees } from "@/features/git/state";
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
  const hasSessions = live.length > 0 || finished.length > 0;

  return (
    <div class="dock-view">
      {waiting.value.length > 0 && (
        <WaitingList sessions={waiting.value} projects={projects.value} />
      )}

      {live.length === 0 && (
        <SectionLabel flush action={<PanelActions panel="sessions" />}>
          {t("sessions.running")}
        </SectionLabel>
      )}

      {!hasSessions && <p class="px-1 text-faint">{t("sessions.empty")}</p>}

      {live.length > 0 && (
        <Fragment>
          <SectionLabel flush count={live.length} action={<PanelActions panel="sessions" />}>
            {t("sessions.running")}
          </SectionLabel>
          <ul class="flex flex-col">{renderTree(live)}</ul>
        </Fragment>
      )}

      {finished.length > 0 && (
        <Fragment>
          <SectionLabel
            flush={live.length === 0}
            count={finished.length}
            action={
              <button
                type="button"
                title={t("sessions.clearFinished")}
                onClick={() => {
                  for (const session of finished) {
                    requestClose(session);
                  }
                }}
                class="text-faint transition-colors hover:text-text"
              >
                <Icon name="close" size={12} />
              </button>
            }
          >
            {t("sessions.finished")}
          </SectionLabel>
          <ul class="flex flex-col">{renderTree(finished)}</ul>
        </Fragment>
      )}

      <OrphanTrees />

      {elsewhere.length > 0 && <ElsewhereList sessions={elsewhere} projects={projects.value} />}
    </div>
  );
}

function OrphanTrees() {
  const owners = sessionOfWorktree.value;
  const orphans = worktrees.value.filter((tree) => !owners.has(tree.path));
  if (orphans.length === 0) {
    return null;
  }

  return (
    <Fragment>
      <SectionLabel count={orphans.length}>{t("sessions.worktrees")}</SectionLabel>
      {orphans.map((tree) => (
        <ListRow
          key={tree.path}
          label={tree.branch}
          mono
          title={tree.path}
          lead={<Icon name="branch" size={13} class="text-faint" />}
          trail={
            <span class={tree.changed > 0 ? "text-git-dirty" : undefined}>
              {tree.changed > 0
                ? t("sessions.treeChanged", { count: String(tree.changed) })
                : t("sessions.treeClean")}
            </span>
          }
          onClick={() => {
            selectTarget({ type: "worktree", path: tree.path });
            revealPanel("git");
          }}
        />
      ))}
    </Fragment>
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
            class="ml-3 flex items-center gap-1 py-0.5 pl-2 text-xs text-faint transition-colors hover:text-text"
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
