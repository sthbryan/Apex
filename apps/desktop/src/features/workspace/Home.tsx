import {
  Button,
  Composer,
  DiffStat,
  Dot,
  ListRow,
  SectionLabel,
  ToggleChip,
  ToggleChipGroup,
  Welcome,
  Wordmark,
} from "@apex/ui";
import { useEffect, useRef, useState } from "preact/hooks";

import { revealPanel } from "@/app/layout/actions";
import { pending } from "@/features/git/state";
import { push } from "@/features/notifications/state";
import { activeProject, projectSessions } from "@/features/projects/state";
import { openRace } from "@/features/race/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { slugify, suggestName } from "@/features/sessions/naming";
import { startSession } from "@/features/sessions/pending";
import { raceSession } from "@/features/sessions/state";
import { enabledAgents, lastAgent, runsUnattended } from "@/features/settings/agentMode";
import { focusSession, homeAsk, homeRacing } from "@/features/workspace/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const SUGGESTIONS = 2;
const SLUG_LIMIT = 40;

type Mode = "session" | "race";

export function Home() {
  const project = activeProject.value;
  const runnable = enabledAgents.value.filter((agent) => agent.agentic);
  const [mode, setMode] = useState<Mode>("session");
  const [picked, setPicked] = useState<string[]>(() => remembered(runnable.map((a) => a.name)));
  const [isolate, setIsolate] = useState(false);
  const [task, setTask] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
    if (homeRacing.value) {
      setMode("race");
    }
  }, [homeAsk.value]);

  const racing = mode === "race";
  const chosen = picked.filter((name) => runnable.some((agent) => agent.name === name));
  const ready = project !== null && task.trim().length > 0 && chosen.length >= (racing ? 2 : 1);

  const pick = (name: string) => {
    if (!racing) {
      setPicked([name]);
      return;
    }
    setPicked((current) =>
      current.includes(name) ? current.filter((other) => other !== name) : [...current, name],
    );
  };

  const swapMode = (next: string) => {
    setMode(next as Mode);
    if (next === "session") {
      setPicked((current) => current.slice(0, 1));
    }
  };

  const start = (event: Event) => {
    event.preventDefault();
    if (!ready || !project) {
      return;
    }
    const text = task.trim();
    setTask("");
    setMode("session");
    setIsolate(false);
    setPicked(remembered(runnable.map((agent) => agent.name)));

    if (racing) {
      void raceSession(project.id, chosen, text, chosen.filter(runsUnattended))
        .then((started) => {
          openRace.value = started[0]?.run ?? null;
          push({
            sessionId: null,
            kind: "info",
            title: t("race.started", { count: String(started.length) }),
            body: started.map((session) => session.agent).join(", "),
          });
        })
        .catch(complain);
      return;
    }

    const agent = chosen[0];
    const alone = isolate && project.is_git;
    void startSession(
      { id: 0, project: project.id, agent, direction: null, isGit: project.is_git, task: text },
      alone ? "worktree" : "directory",
      alone ? (text ? slugify(text).slice(0, SLUG_LIMIT) : suggestName(agent)) : null,
    ).catch(complain);
  };

  return (
    <Welcome
      class="h-full overflow-y-auto"
      mark={<Wordmark size="xl">APEX</Wordmark>}
      tagline={t("home.tagline")}
      suggestions={recentTasks().map((recent) => (
        <Button key={recent} size="sm" class="rounded-full" onClick={() => setTask(recent)}>
          {recent}
        </Button>
      ))}
      foot={<Summary />}
    >
      <Composer
        elRef={field}
        label={t("home.task")}
        placeholder={racing ? t("home.racePlaceholder") : t("home.placeholder")}
        value={task}
        onInput={(event) => setTask(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.isComposing && ready) {
            start(event);
          }
        }}
        onSubmit={start}
        lead={
          <>
            <ToggleChipGroup label={t("home.agents")} scroll>
              {runnable.map((agent) => {
                const on = chosen.includes(agent.name);
                return (
                  <ToggleChip
                    key={agent.name}
                    pressed={on}
                    iconOnly={!on}
                    title={agent.name}
                    lead={<AgentIcon agent={agent.name} size="sm" />}
                    onClick={() => pick(agent.name)}
                  >
                    {on ? agent.name : null}
                  </ToggleChip>
                );
              })}
            </ToggleChipGroup>
            <span class="mx-0.5 h-5 w-px flex-none bg-border" />
            <ToggleChip
              pressed={racing}
              title={t("home.modeRaceHint")}
              lead={<Icon name="swap" size={13} />}
              onClick={() => swapMode(racing ? "session" : "race")}
            >
              {t("home.modeRace")}
            </ToggleChip>
            {!racing && project?.is_git && (
              <ToggleChip
                pressed={isolate}
                title={t("isolation.worktreeHint")}
                lead={<Icon name="branch" size={13} />}
                onClick={() => setIsolate((on) => !on)}
              >
                {t("home.isolate")}
              </ToggleChip>
            )}
          </>
        }
        actions={
          <Button type="submit" variant="primary" disabled={!ready} title={t("home.startHint")}>
            <Icon name="send" size={13} />
            {racing ? t("home.race") : t("home.start")}
          </Button>
        }
      />
    </Welcome>
  );
}

function remembered(names: string[]): string[] {
  const last = lastAgent.value;
  return last && names.includes(last) ? [last] : [];
}

function recentTasks(): string[] {
  const seen: string[] = [];
  for (const session of projectSessions.value) {
    const task = session.task?.trim();
    if (task && !seen.includes(task)) {
      seen.push(task);
    }
  }
  return seen.slice(0, SUGGESTIONS);
}

function Summary() {
  const sessions = projectSessions.value;
  const blocked = sessions.filter((session) => session.state === "blocked");
  const working = sessions.filter((session) => session.state === "working");
  const reviews = pending.value;

  if (blocked.length + reviews.length + working.length === 0) {
    return null;
  }

  return (
    <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-6 gap-y-4 text-left">
      {blocked.length + reviews.length > 0 && (
        <div>
          <SectionLabel flush count={blocked.length + reviews.length}>
            {t("home.waiting")}
          </SectionLabel>
          {blocked.map((session) => (
            <ListRow
              key={session.id}
              label={session.title}
              sub={session.task ?? undefined}
              lead={<Dot state="blocked" />}
              trail={<AgentIcon agent={session.agent} />}
              onClick={() => focusSession(session.id)}
            />
          ))}
          {reviews.map((review) => (
            <ListRow
              key={review.branch}
              label={review.title ?? review.branch}
              sub={
                <>
                  {review.branch} · {t("home.files", { count: String(review.files) })}
                  <DiffStat added={review.added} removed={review.removed} />
                </>
              }
              lead={<Icon name="inbox" size={13} class="text-faint" />}
              trail={<span>{t("home.review")}</span>}
              onClick={() => revealPanel("review")}
            />
          ))}
        </div>
      )}
      {working.length > 0 && (
        <div>
          <SectionLabel flush count={working.length}>
            {t("home.running")}
          </SectionLabel>
          {working.map((session) => (
            <ListRow
              key={session.id}
              label={session.title}
              sub={session.task ?? undefined}
              lead={<Dot state="working" />}
              trail={<AgentIcon agent={session.agent} />}
              onClick={() => focusSession(session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
