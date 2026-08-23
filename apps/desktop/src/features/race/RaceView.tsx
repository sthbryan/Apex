import {
  AgentIcon,
  Button,
  DiffStat,
  Dot,
  RaceView as KitRaceView,
  RaceColumn,
  RaceDecision,
} from "@apex/ui";
import { useState } from "preact/hooks";

import {
  type Contender,
  contendersOf,
  contenderTarget,
  races,
  settleRace,
} from "@/features/race/state";
import { openReview } from "@/features/review/state";
import { stateOf } from "@/features/sessions/dot";
import { t } from "@/shared/i18n";

export function RaceView({ run }: { run: string }) {
  const [asking, setAsking] = useState<string | null>(null);
  const race = races.value.find((candidate) => candidate.id === run);

  if (!race) {
    return <p class="p-2 text-faint">{t("race.gone")}</p>;
  }

  const contenders = contendersOf(race);
  const chosen = contenders.find((contender) => contender.session.id === asking);

  return (
    <KitRaceView
      class="h-full"
      task={race.task}
      foot={
        chosen && (
          <RaceDecision
            info={t("race.keepAsk", { count: String(race.contenders.length - 1) })}
            actions={
              <>
                <Button size="sm" onClick={() => setAsking(null)}>
                  {t("race.keepNo")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void settleRace(race, chosen.session.id)}
                >
                  {t("race.keepYes")}
                </Button>
              </>
            }
          />
        )
      }
    >
      {contenders.map((contender) => (
        <Column
          key={contender.session.id}
          contender={contender}
          onKeep={() => setAsking(contender.session.id)}
        />
      ))}
    </KitRaceView>
  );
}

function Column({ contender, onKeep }: { contender: Contender; onKeep: () => void }) {
  const { session, changed } = contender;
  const target = contenderTarget(session);
  const dead = session.exit_code !== null;

  return (
    <RaceColumn
      name={session.agent}
      state={dead ? "dropped" : "running"}
      lead={<AgentIcon agent={session.agent} size="sm" />}
      trail={<Dot state={stateOf(session)} size="sm" />}
    >
      {changed === null ? (
        <p class="text-faint">{dead ? t("race.leftNothing") : t("race.stillWorking")}</p>
      ) : (
        <div class="flex flex-col items-start gap-1.5">
          <p class="flex items-center gap-1.5 tabular-nums text-faint">
            {t("review.files", { count: String(changed.files) })}
            <DiffStat added={changed.added} removed={changed.removed} />
          </p>
          <Button size="xs" variant="subtle" onClick={() => void openReview(target)}>
            {t("race.inspect")}
          </Button>
          <Button size="xs" variant="primary" onClick={onKeep}>
            {t("race.keep")}
          </Button>
        </div>
      )}
    </RaceColumn>
  );
}
