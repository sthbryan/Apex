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
import { useState } from "preact/hooks";

import { revealPanel } from "@/app/layout/actions";
import { pending } from "@/features/git/state";
import { activeProject, projectSessions } from "@/features/projects/state";
import { openRace } from "@/features/race/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { requestSession } from "@/features/sessions/pending";
import { raceSession } from "@/features/sessions/state";
import { enabledAgents, runsUnattended } from "@/features/settings/agentMode";
import { focusSession } from "@/features/workspace/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const SUGGESTIONS = 2;

export function Home() {
  const project = activeProject.value;
  const runnable = enabledAgents.value.filter((agent) => agent.agentic);
  const [picked, setPicked] = useState<string[]>([]);
  const [task, setTask] = useState("");

  const chosen = picked.length > 0 ? picked : runnable.slice(0, 1).map((agent) => agent.name);
  const racing = chosen.length > 1;
  const ready = project !== null && task.trim().length > 0 && (!racing || project.is_git);

  const toggle = (name: string) => {
    setPicked((current) =>
      current.includes(name)
        ? current.filter((candidate) => candidate !== name)
        : [...chosen.filter((candidate) => candidate !== name), name],
    );
  };

  const start = (event: Event) => {
    event.preventDefault();
    if (!ready || !project) {
      return;
    }
    const text = task.trim();
    setTask("");
    if (racing) {
      void raceSession(project.id, chosen, text, chosen.filter(runsUnattended))
        .then((started) => {
          openRace.value = started[0]?.run ?? null;
        })
        .catch(complain);
      return;
    }
    requestSession({
      project: project.id,
      agent: chosen[0],
      direction: null,
      isGit: project.is_git,
      task: text,
    });
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
        label={t("home.task")}
        placeholder={t("home.placeholder")}
        value={task}
        onInput={(event) => setTask(event.currentTarget.value)}
        onSubmit={start}
        lead={
          <ToggleChipGroup label={t("home.agents")}>
            {runnable.map((agent) => (
              <ToggleChip
                key={agent.name}
                pressed={chosen.includes(agent.name)}
                lead={<AgentIcon agent={agent.name} size="sm" />}
                onClick={() => toggle(agent.name)}
              >
                {agent.name}
              </ToggleChip>
            ))}
          </ToggleChipGroup>
        }
        actions={
          <Button
            type="submit"
            variant="primary"
            disabled={!ready}
            title={racing && project && !project.is_git ? t("git.noRepo") : undefined}
          >
            <Icon name="send" size={13} />
            {racing ? t("home.race") : t("home.start")}
          </Button>
        }
      />
    </Welcome>
  );
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
