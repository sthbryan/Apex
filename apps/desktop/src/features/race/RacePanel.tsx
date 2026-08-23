import { Button, Card, Dot, ListRow, SectionLabel } from "@apex/ui";
import { useState } from "preact/hooks";

import { PanelActions } from "@/app/layout/PanelActions";
import type { SessionState } from "@/bindings/SessionState";
import { activeProject } from "@/features/projects/state";
import { RaceLauncher } from "@/features/race/RaceLauncher";
import { contendersOf, openRace, type Race, raceSettled, races } from "@/features/race/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { countdown } from "@/features/usage/format";
import { openRaceView } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const STATES: Record<SessionState, "done" | "blocked" | "working" | "idle"> = {
  done: "done",
  blocked: "blocked",
  working: "working",
  idle: "idle",
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
    <div class="dock-view">
      <SectionLabel
        flush
        count={all.length || undefined}
        action={
          <PanelActions panel="race">
            <button
              type="button"
              title={t("race.new")}
              onClick={() => setLaunching((open) => !open)}
              class="shrink-0 text-faint transition-colors hover:text-text"
            >
              <Icon name={launching ? "close" : "plus"} size={12} />
            </button>
          </PanelActions>
        }
      >
        {t("race.live")}
      </SectionLabel>

      {launching && <RaceLauncher onDone={() => setLaunching(false)} />}

      {all.map((race) => (
        <Entry key={race.id} race={race} />
      ))}

      {all.length === 0 && !launching && <p class="px-1.5 py-1 text-faint">{t("race.empty")}</p>}

      {!launching && (
        <Button variant="dashed" size="lg" class="mt-2" onClick={() => setLaunching(true)}>
          {t("race.new")}
        </Button>
      )}
    </div>
  );
}

function Entry({ race }: { race: Race }) {
  const chosen = openRace.value === race.id;
  const open = () => {
    openRace.value = race.id;
    openRaceView(race.id);
  };

  return (
    <>
      <Card
        elevation="raised"
        title={race.task || t("race.title")}
        class={chosen ? "border-accent" : undefined}
        onClick={open}
      >
        <span class="text-xs text-muted">
          {t("race.contenders", { count: String(race.contenders.length) })} ·{" "}
          {countdown(Date.now() / 1000 - race.startedAt) ?? t("sessions.justNow")}
        </span>
      </Card>
      {contendersOf(race).map(({ session, changed }) => (
        <ListRow
          as="div"
          key={session.id}
          label={session.agent}
          sub={
            changed
              ? t("race.changed", {
                  files: String(changed.files),
                  added: String(changed.added),
                  removed: String(changed.removed),
                })
              : undefined
          }
          lead={<AgentIcon agent={session.agent} size="sm" />}
          trail={
            <Dot
              size="sm"
              title={session.agent}
              state={session.exit_code !== null ? "done" : STATES[session.state]}
              class={session.exit_code !== null ? "opacity-50" : undefined}
            />
          }
          onClick={open}
        />
      ))}
    </>
  );
}

export function racesWaiting(): boolean {
  return races.value.some(raceSettled);
}
