import { computed, signal } from "@preact/signals";

import type { SessionSummary } from "@/bindings/SessionSummary";
import { projectSessions } from "@/features/projects/state";

export type Race = {
  id: string;
  task: string;
  startedAt: number;
  contenders: SessionSummary[];
};

export const openRace = signal<string | null>(null);

export const races = computed<Race[]>(() => {
  const grouped = new Map<string, SessionSummary[]>();
  for (const session of projectSessions.value) {
    if (session.run === null) {
      continue;
    }
    const already = grouped.get(session.run);
    if (already) {
      already.push(session);
    } else {
      grouped.set(session.run, [session]);
    }
  }
  return [...grouped.entries()]
    .map(([id, contenders]) => ({
      id,
      task: contenders.find((session) => session.task !== null)?.task ?? "",
      startedAt: Math.min(...contenders.map((session) => session.started_at)),
      contenders: contenders.slice().sort((left, right) => left.agent.localeCompare(right.agent)),
    }))
    .sort((left, right) => right.startedAt - left.startedAt);
});

export const currentRace = computed(
  () => races.value.find((race) => race.id === openRace.value) ?? races.value[0] ?? null,
);

export function raceSettled(race: Race): boolean {
  return race.contenders.every((session) => session.state === "done" || session.exit_code !== null);
}
