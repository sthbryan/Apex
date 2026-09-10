import {
  Button,
  Composer,
  DiffStat,
  Dot,
  ListRow,
  SectionLabel,
  Spinner,
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
import { playTypingCue } from "@/features/settings/sounds";
import { focusSession, homeAsk, homeRacing } from "@/features/workspace/state";
import { spell } from "@/shared/daemon";
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
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (field.current) field.current.readOnly = starting;
    if (!starting) return;
    const began = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - began) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [starting]);

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

  const start = async (event: Event) => {
    event.preventDefault();
    if (!ready || !project || inFlight.current) {
      return;
    }
    const text = task.trim();
    inFlight.current = true;
    setStarting(true);
    setSeconds(0);
    setStartError(null);

    try {
      if (racing) {
        const started = await raceSession(project.id, chosen, text, chosen.filter(runsUnattended));
        openRace.value = started[0]?.run ?? null;
        push({
          sessionId: null,
          kind: "info",
          title: t("race.started", { count: String(started.length) }),
          body: started.map((session) => session.agent).join(", "),
        });
      } else {
        const agent = chosen[0];
        const alone = isolate && project.is_git;
        await startSession(
          { id: 0, project: project.id, agent, direction: null, isGit: project.is_git, task: text },
          alone ? "worktree" : "directory",
          alone ? (text ? slugify(text).slice(0, SLUG_LIMIT) : suggestName(agent)) : null,
        );
      }
      setTask("");
      setMode("session");
      setIsolate(false);
      setPicked(remembered(runnable.map((agent) => agent.name)));
    } catch (cause) {
      setStartError(spell(cause));
    } finally {
      inFlight.current = false;
      setStarting(false);
    }
  };

  return (
    <Welcome
      class="h-full overflow-y-auto"
      mark={<Wordmark size="xl">APEX</Wordmark>}
      tagline={t("home.tagline")}
      suggestions={recentTasks().map((recent) => (
        <Button
          key={recent}
          disabled={starting}
          size="sm"
          class="max-w-full truncate"
          title={recent}
          onClick={() => setTask(recent)}
        >
          {recent}
        </Button>
      ))}
      foot={<Summary />}
    >
      <Composer
        class="home-composer mt-3"
        aria-busy={starting}
        elRef={field}
        label={t("home.task")}
        placeholder={racing ? t("home.racePlaceholder") : t("home.placeholder")}
        value={task}
        onInput={(event) => {
          if (inFlight.current) return;
          setTask(event.currentTarget.value);
          playTypingCue();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.isComposing && ready) {
            start(event);
          }
        }}
        onSubmit={start}
        lead={
          <>
            <ToggleChipGroup class="home-agents" label={t("home.agents")} scroll>
              {runnable.map((agent) => {
                const on = chosen.includes(agent.name);
                return (
                  <ToggleChip
                    key={agent.name}
                    pressed={on}
                    disabled={starting}
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
            <div class="home-options">
              <button
                type="button"
                class="home-option"
                title={t("home.modeRaceHint")}
                aria-pressed={racing}
                disabled={starting}
                onClick={() => swapMode(racing ? "session" : "race")}
              >
                <Icon name="swap" size={14} />
                {t("home.modeRace")}
              </button>
              {(racing || project?.is_git) && (
                <button
                  type="button"
                  class="home-option"
                  title={t("isolation.worktreeHint")}
                  aria-pressed={racing || isolate}
                  disabled={racing || starting}
                  onClick={() => setIsolate((on) => !on)}
                >
                  <Icon name="branch" size={14} />
                  {t("home.isolate")}
                </button>
              )}
            </div>
          </>
        }
        actions={
          <Button
            type="submit"
            variant="primary"
            disabled={!ready || starting}
            title={t("home.startHint")}
          >
            {starting ? (
              <Spinner size="sm" label={t("home.starting")} />
            ) : (
              <Icon name="send" size={13} />
            )}
            {starting ? t("home.starting") : racing ? t("home.race") : t("home.start")}
          </Button>
        }
      />
      {starting && (
        <p class="w-full text-left text-sm text-muted" role="status">
          {t(seconds >= 15 ? "home.startSlow" : "home.startWait", { agents: chosen.join(", ") })}
          <span class="ml-2 font-mono tabular-nums" aria-hidden="true">
            {seconds}s
          </span>
        </p>
      )}
      {startError && (
        <p class="w-full text-left text-sm text-state-failed" role="alert">
          {startError}
        </p>
      )}
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
    <div class="home-summary flex flex-col gap-6 text-left">
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
