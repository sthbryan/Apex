import { Fragment } from "preact";
import { PanelHeader } from "@/app/layout/PanelHeader";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { waiting } from "@/features/notifications/state";
import { projectSessions, projects } from "@/features/projects/state";
import { requestClose } from "@/features/sessions/pending";
import { SessionRow } from "@/features/sessions/SessionRow";
import { WaitingList } from "@/features/sessions/WaitingList";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

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

        {!hasSessions && <p class="px-1 text-faint">{t("sessions.empty")}</p>}

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

function renderTree(sessions: SessionSummary[]) {
  const { roots, byParent } = treeOf(sessions);
  return roots.map((session) => renderRow(session, byParent));
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
