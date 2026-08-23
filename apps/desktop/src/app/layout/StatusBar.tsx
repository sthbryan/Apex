import { StatusBar as Bar, StatusPill } from "@apex/ui";
import { revealPanel } from "@/app/layout/actions";
import { GitChip } from "@/features/git/GitChip";
import { NotifyChip } from "@/features/notifications/NotifyChip";
import { races } from "@/features/race/state";
import { ResourcesSummary } from "@/features/resources/ResourcesSummary";
import { UsageStrip } from "@/features/usage/UsageStrip";
import { t } from "@/shared/i18n";

export function StatusBar() {
  return (
    <Bar
      right={
        <>
          <NotifyChip />
          <ResourcesSummary />
        </>
      }
    >
      <GitChip />
      <Racing />
      <UsageStrip />
    </Bar>
  );
}

function Racing() {
  const running = races.value.filter((race) =>
    race.contenders.some((session) => session.exit_code === null && session.state !== "done"),
  );
  if (running.length === 0) {
    return null;
  }
  return (
    <StatusPill live title={t("race.title")} onClick={() => revealPanel("race")}>
      {t("race.running", { count: String(running.length) })}
    </StatusPill>
  );
}
