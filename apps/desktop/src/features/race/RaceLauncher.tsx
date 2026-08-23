import cn from "cnfast";
import { useState } from "preact/hooks";

import { activeProject } from "@/features/projects/state";
import { openRace } from "@/features/race/state";
import { raceSession } from "@/features/sessions/state";
import { enabledAgents, runsUnattended } from "@/features/settings/agentMode";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";

export function RaceLauncher({ onDone }: { onDone: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [task, setTask] = useState("");
  const [starting, setStarting] = useState(false);
  const project = activeProject.value;

  const runnable = enabledAgents.value.filter((agent) => agent.agentic);
  const ready = project !== null && picked.length > 1 && task.trim().length > 0 && !starting;

  const toggle = (name: string) => {
    setPicked((current) =>
      current.includes(name)
        ? current.filter((candidate) => candidate !== name)
        : [...current, name],
    );
  };

  const start = () => {
    if (!ready || !project) {
      return;
    }
    setStarting(true);
    void raceSession(project.id, picked, task.trim(), picked.filter(runsUnattended))
      .then((started) => {
        openRace.value = started[0]?.run ?? null;
        onDone();
      })
      .catch((cause: unknown) => complain(cause))
      .finally(() => setStarting(false));
  };

  return (
    <div class="flex flex-col gap-2 p-2">
      <p class="text-faint">{t("race.pickAgents")}</p>
      <div class="flex flex-wrap gap-1">
        {runnable.map((agent) => (
          <button
            key={agent.name}
            type="button"
            onClick={() => toggle(agent.name)}
            class={cn(
              "rounded border px-2 py-0.5 transition-colors",
              picked.includes(agent.name)
                ? "border-accent bg-raised text-text"
                : "border-border text-muted hover:text-text",
            )}
          >
            {agent.name}
          </button>
        ))}
      </div>
      {runnable.length < 2 && <p class="text-faint">{t("race.needAgents")}</p>}

      <textarea
        rows={4}
        value={task}
        placeholder={t("race.taskPlaceholder")}
        spellcheck={false}
        onInput={(event) => setTask(event.currentTarget.value)}
        class="field-sizing-content max-h-56 min-h-16 w-full resize-none rounded border border-border bg-transparent px-2 py-1.5 text-text outline-none placeholder:text-faint"
      />

      <div class="flex items-center gap-2">
        <span class="min-w-0 flex-1 truncate text-faint">
          {picked.length > 1
            ? t("race.willStart", { count: String(picked.length) })
            : t("race.pickTwo")}
        </span>
        <button
          type="button"
          onClick={onDone}
          class="shrink-0 rounded border border-border px-2 py-0.5 text-muted transition-colors hover:text-text"
        >
          {t("race.cancel")}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={start}
          class="shrink-0 rounded border border-border px-2 py-0.5 text-muted transition-colors enabled:hover:bg-raised enabled:hover:text-text disabled:opacity-40"
        >
          {t("race.start")}
        </button>
      </div>
    </div>
  );
}
