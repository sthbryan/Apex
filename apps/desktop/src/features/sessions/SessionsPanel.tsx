import { useState } from "preact/hooks";

import { Icon } from "@/shared/ui/Icon";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { t } from "@/shared/i18n";
import { waiting } from "@/features/notifications/state";
import { switchTo } from "@/features/projects/state";
import { closeSession } from "@/features/sessions/state";
import { activeSessionId, dropSession, focusSession, openInNewTab } from "@/features/workspace/state";
import { cn } from "cnfast";

type Props = {
  sessions: SessionSummary[];
  elsewhere: SessionSummary[];
  projects: ProjectSummary[];
};

const STATE_STYLES: Record<string, string> = {
  idle: "border border-state-idle",
  working: "bg-state-working",
  blocked: "bg-state-blocked",
  done: "bg-state-done",
};

export function SessionsPanel({ sessions, elsewhere, projects }: Props) {
  const live = sessions.filter((session) => session.exit_code === null);
  const finished = sessions.filter((session) => session.exit_code !== null);

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-2">
      {waiting.value.length > 0 && <Waiting sessions={waiting.value} projects={projects} />}

      <section>
        <h2 class="mb-1 px-1 uppercase tracking-wider text-faint">{t("sessions.live")}</h2>
        {live.length === 0 ? (
          <p class="px-1 text-faint">{t("sessions.empty")}</p>
        ) : (
          <ul class="flex flex-col">
            {live.map((session) => (
              <Row key={session.id} session={session} />
            ))}
          </ul>
        )}
      </section>

      {finished.length > 0 && (
        <section>
          <div class="mb-1 flex items-center gap-2 px-1">
            <h2 class="uppercase tracking-wider text-faint">{t("sessions.finished")}</h2>
            <button
              type="button"
              title={t("sessions.clearFinished")}
              onClick={() => {
                for (const session of finished) {
                  dismiss(session.id);
                }
              }}
              class="ml-auto text-faint transition-colors hover:text-text"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
          <ul class="flex flex-col">
            {finished.map((session) => (
              <Row key={session.id} session={session} />
            ))}
          </ul>
        </section>
      )}

      {elsewhere.length > 0 && <Elsewhere sessions={elsewhere} projects={projects} />}
    </div>
  );
}

function Waiting({
  sessions,
  projects,
}: {
  sessions: SessionSummary[];
  projects: ProjectSummary[];
}) {
  return (
    <section class="animate-pop-in rounded border border-state-blocked/40 bg-state-blocked/5 p-1">
      <h2 class="mb-1 px-1 uppercase tracking-wider text-state-blocked">
        {t("sessions.waiting")}
      </h2>
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

function Elsewhere({ sessions, projects }: { sessions: SessionSummary[]; projects: ProjectSummary[] }) {
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
        class="mb-1 flex w-full items-center gap-2 px-1 uppercase tracking-wider text-faint hover:text-muted"
      >
        <Icon name="chevron" size={12} class={cn("transition-transform", open ? "" : "-rotate-90")} />
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
                    <StateDot session={session} />
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

function Row({ session }: { session: SessionSummary }) {
  const finished = session.exit_code !== null;

  return (
    <li
      class={cn(
        "group flex animate-row-in items-center gap-2 rounded px-1 transition-colors hover:bg-raised",
        activeSessionId.value === session.id ? "bg-raised" : ""
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (!focusSession(session.id)) {
            openInNewTab(session);
          }
        }}
        class={cn(
          "flex min-w-0 flex-1 items-center gap-2 py-1 text-left",
          finished ? "text-muted" : ""
        )}
      >
        <StateDot session={session} />
        <span class="truncate">{session.title}</span>
        {finished && (
          <span class="ml-auto shrink-0 text-faint">
            {t("sessions.exited", { code: String(session.exit_code) })}
          </span>
        )}
      </button>
      <button
        type="button"
        title={finished ? t("sessions.dismiss") : t("sessions.close")}
        onClick={() => dismiss(session.id)}
        class="shrink-0 text-faint opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-text"
      >
        <Icon name="close" size={12} />
      </button>
    </li>
  );
}

function StateDot({ session }: { session: SessionSummary }) {
  const live = session.exit_code === null;
  return (
    <span class="relative flex size-2 shrink-0">
      {live && session.state === "working" && (
        <span class="absolute inset-0 animate-ping rounded-full bg-state-working opacity-60" />
      )}
      <span class={cn("relative size-2 rounded-full", dotStyle(session))} />
    </span>
  );
}

function dotStyle(session: SessionSummary): string {
  if (session.exit_code !== null) {
    return session.exit_code === 0 ? "bg-state-done" : "bg-state-failed";
  }
  return STATE_STYLES[session.state] ?? STATE_STYLES.idle;
}

function dismiss(id: string): void {
  dropSession(id);
  void closeSession(id);
}
