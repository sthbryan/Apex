import cn from "cnfast";
import { useState } from "preact/hooks";

import { PanelActions } from "@/app/layout/PanelActions";
import type { SessionState } from "@/bindings/SessionState";
import { activeProject } from "@/features/projects/state";
import { RaceLauncher } from "@/features/race/RaceLauncher";
import { openRace, type Race, raceSettled, races } from "@/features/race/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const DOTS: Record<SessionState, string> = {
  done: "bg-state-done",
  blocked: "bg-state-blocked",
  working: "bg-state-working animate-pulse",
  idle: "bg-state-idle",
};

export function RacePanel() {
  const [launching, setLaunching] = useState(false);
  const project = activeProject.value;
  const all = races.value;

  if (!project) {
    return <p class="p-2 text-faint">{t("files.noProject")}</p>;
  }
  if (!project.is_git) {
    return <p class="p-2 text-faint">{t("git.noRepo")}</p>;
  }

  return (
    <div class="flex h-full flex-col">
      <PanelActions>
        <button
          type="button"
          title={t("race.new")}
          onClick={() => setLaunching((open) => !open)}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name={launching ? "close" : "plus"} size={12} />
        </button>
      </PanelActions>

      {launching && <RaceLauncher onDone={() => setLaunching(false)} />}

      {all.length === 0 ? (
        !launching && <p class="px-2 py-1 text-faint">{t("race.empty")}</p>
      ) : (
        <ul class="min-h-0 flex-1 overflow-auto pb-1">
          {all.map((race) => (
            <Entry key={race.id} race={race} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Entry({ race }: { race: Race }) {
  const chosen = openRace.value === race.id;

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          openRace.value = race.id;
        }}
        class={cn(
          "flex w-full items-center gap-2 px-2 py-1 text-left transition-colors hover:bg-raised",
          chosen && "bg-raised",
        )}
      >
        <span class="min-w-0 flex-1 truncate text-text">{race.task || t("race.title")}</span>
        <span class="flex shrink-0 items-center gap-1">
          {race.contenders.map((session) => (
            <span
              key={session.id}
              title={session.agent}
              class={cn(
                "size-1.5 rounded-full",
                session.exit_code !== null ? "bg-faint" : DOTS[session.state],
              )}
            />
          ))}
        </span>
      </button>
    </li>
  );
}

export function racesWaiting(): boolean {
  return races.value.some(raceSettled);
}
