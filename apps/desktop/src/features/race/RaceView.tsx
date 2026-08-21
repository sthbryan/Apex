import cn from "cnfast";
import { useState } from "preact/hooks";

import type { SessionState } from "@/bindings/SessionState";
import {
  type Contender,
  contendersOf,
  contenderTarget,
  type Race,
  races,
  settleRace,
} from "@/features/race/state";
import { openReview } from "@/features/review/state";
import { t } from "@/shared/i18n";

const DOTS: Record<SessionState, string> = {
  done: "bg-state-done",
  blocked: "bg-state-blocked",
  working: "bg-state-working animate-pulse",
  idle: "bg-state-idle",
};

export function RaceView({ run }: { run: string }) {
  const race = races.value.find((candidate) => candidate.id === run);

  if (!race) {
    return <p class="p-2 text-faint">{t("race.gone")}</p>;
  }

  const contenders = contendersOf(race);

  return (
    <div class="flex h-full flex-col">
      <p class="shrink-0 truncate border-b border-border px-2 py-1.5 text-muted">{race.task}</p>
      <div class="grid min-h-0 flex-1 auto-cols-fr grid-flow-col divide-x divide-border overflow-auto">
        {contenders.map((contender) => (
          <Column key={contender.session.id} contender={contender} race={race} />
        ))}
      </div>
    </div>
  );
}

function Column({ contender, race }: { contender: Contender; race: Race }) {
  const [asking, setAsking] = useState(false);
  const { session, changed } = contender;
  const target = contenderTarget(session);
  const dead = session.exit_code !== null;

  return (
    <div class="flex min-w-0 flex-col">
      <div class="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-1.5">
        <span
          class={cn("size-1.5 shrink-0 rounded-full", dead ? "bg-faint" : DOTS[session.state])}
        />
        <span class="min-w-0 flex-1 truncate text-text">{session.agent}</span>
      </div>

      {changed === null ? (
        <p class="px-2 py-1 text-faint">{dead ? t("race.leftNothing") : t("race.stillWorking")}</p>
      ) : (
        <>
          <p class="px-2 py-1 tabular-nums text-faint">
            {t("review.files", { count: String(changed.files) })}
            <span class="ml-1.5 text-git-added">+{changed.added}</span>
            <span class="ml-1 text-git-removed">−{changed.removed}</span>
          </p>
          <button
            type="button"
            onClick={() => void openReview(target)}
            class="mx-2 mb-1 shrink-0 rounded border border-border px-2 py-0.5 text-muted transition-colors hover:bg-raised hover:text-text"
          >
            {t("race.inspect")}
          </button>
        </>
      )}

      <div class="mt-auto shrink-0 border-t border-border px-2 py-1.5">
        {asking ? (
          <div class="flex items-center gap-1.5">
            <span class="min-w-0 flex-1 truncate text-faint">
              {t("race.keepAsk", { count: String(race.contenders.length - 1) })}
            </span>
            <button
              type="button"
              onClick={() => setAsking(false)}
              class="shrink-0 text-muted transition-colors hover:text-text"
            >
              {t("race.keepNo")}
            </button>
            <button
              type="button"
              onClick={() => void settleRace(race, session.id)}
              class="shrink-0 text-git-removed transition-colors hover:brightness-125"
            >
              {t("race.keepYes")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            class="w-full rounded border border-border px-2 py-0.5 text-muted transition-colors hover:bg-raised hover:text-text"
          >
            {t("race.keep")}
          </button>
        )}
      </div>
    </div>
  );
}
