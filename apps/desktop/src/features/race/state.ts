import { computed, signal } from "@preact/signals";

import type { GitTarget } from "@/bindings/GitTarget";
import type { PendingReview } from "@/bindings/PendingReview";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { pending } from "@/features/git/state";
import { projectSessions } from "@/features/projects/state";
import { openReview } from "@/features/review/state";
import { finishClose } from "@/features/sessions/pending";
import { complain } from "@/shared/daemon";

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
    .filter((race) => race.contenders.length > 1)
    .sort((left, right) => right.startedAt - left.startedAt);
});

export const currentRace = computed(
  () => races.value.find((race) => race.id === openRace.value) ?? races.value[0] ?? null,
);

export function raceSettled(race: Race): boolean {
  return race.contenders.every((session) => session.state === "done" || session.exit_code !== null);
}

export type Contender = {
  session: SessionSummary;
  changed: PendingReview | null;
};

export function contendersOf(race: Race): Contender[] {
  const counted = new Map<string, PendingReview>();
  for (const review of pending.value) {
    if (review.target.type === "session") {
      counted.set(review.target.id, review);
    }
  }
  return race.contenders.map((session) => ({
    session,
    changed: counted.get(session.id) ?? null,
  }));
}

export function contenderTarget(session: SessionSummary): GitTarget {
  return { type: "session", id: session.id };
}

export async function settleRace(race: Race, keeping: string): Promise<void> {
  const losers = race.contenders.filter((session) => session.id !== keeping);
  for (const session of losers) {
    await finishClose(session.id, "discard").catch((cause: unknown) => complain(cause));
  }
  const winner = race.contenders.find((session) => session.id === keeping);
  if (winner) {
    await openReview(contenderTarget(winner));
  }
  openRace.value = null;
}
