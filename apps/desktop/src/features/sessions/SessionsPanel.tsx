import cn from "cnfast";
import { Fragment } from "preact";
import { PanelHeader } from "@/app/layout/PanelHeader";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { waiting } from "@/features/notifications/state";
import { foreignSessions, projectSessions, projects } from "@/features/projects/state";
import { ElsewhereList } from "@/features/sessions/ElsewhereList";
import { requestClose } from "@/features/sessions/pending";
import { SessionRow } from "@/features/sessions/SessionRow";
import { WaitingList } from "@/features/sessions/WaitingList";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Group = {
  label: string;
  dotClass: string;
  sessions: SessionSummary[];
};

export function SessionsPanel() {
  const sessions = projectSessions.value;
  const elsewhere = foreignSessions.value;
  const groups: Group[] = [
    {
      label: t("sessions.running"),
      dotClass: "bg-state-working animate-pulse",
      sessions: sessions.filter(
        (session) => session.exit_code === null && session.state !== "idle",
      ),
    },
    {
      label: t("sessions.idle"),
      dotClass: "border border-state-idle",
      sessions: sessions.filter(
        (session) => session.exit_code === null && session.state === "idle",
      ),
    },
    {
      label: t("sessions.finished"),
      dotClass: "bg-state-done",
      sessions: sessions.filter((session) => session.exit_code !== null),
    },
  ];
  const hasSessions = groups.some((group) => group.sessions.length > 0);

  return (
    <div class="flex h-full flex-col">
      <PanelHeader title={t("dock.sessions")} />
      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        {waiting.value.length > 0 && (
          <WaitingList sessions={waiting.value} projects={projects.value} />
        )}

        {!hasSessions && <p class="px-1 text-faint">{t("sessions.empty")}</p>}

        {groups.map((group) => {
          if (group.sessions.length === 0) {
            return null;
          }
          const { roots, byParent } = treeOf(group.sessions);
          return (
            <section key={group.label} class={cn("animate-row-in", roots.length > 0 && "mb-2")}>
              <div class="mb-1 flex items-center gap-2 px-1">
                <span
                  class={cn("size-1.5 shrink-0 rounded-full", group.dotClass)}
                  aria-hidden="true"
                />
                <h2 class="text-micro uppercase tracking-wider text-faint">
                  {group.label} · {group.sessions.length}
                </h2>
                {group.sessions.length > 0 &&
                  group.sessions.every((session) => session.exit_code !== null) && (
                    <button
                      type="button"
                      title={t("sessions.clearFinished")}
                      onClick={() => {
                        for (const session of group.sessions) {
                          requestClose(session);
                        }
                      }}
                      class="ml-auto text-faint transition-colors hover:text-text"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
              </div>
              <ul class="flex flex-col">{roots.map((session) => renderRow(session, byParent))}</ul>
            </section>
          );
        })}

        {elsewhere.length > 0 && <ElsewhereList sessions={elsewhere} projects={projects.value} />}
      </div>
    </div>
  );
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

function renderRow(session: SessionSummary, byParent: Map<string, SessionSummary[]>, depth = 0) {
  return (
    <Fragment key={session.id}>
      <SessionRow session={session} depth={depth} />
      {(byParent.get(session.id) ?? []).map((child) => renderRow(child, byParent, depth + 1))}
    </Fragment>
  );
}
