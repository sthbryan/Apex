import type { MetricsSnapshot } from "@/bindings/MetricsSnapshot";
import { ApexSection } from "@/features/resources/ApexSection";
import { SessionSection } from "@/features/resources/SessionSection";
import { SystemSection } from "@/features/resources/SystemSection";
import { t } from "@/shared/i18n";

type Props = {
  snapshot: MetricsSnapshot | null;
};

export function ResourcesPanel({ snapshot }: Props) {
  if (!snapshot) {
    return <p class="px-2 py-1.5 text-faint">{t("resources.sampling")}</p>;
  }

  return (
    <div class="flex max-h-96 flex-col overflow-y-auto">
      <ApexSection apex={snapshot.apex} system={snapshot.system} />
      <SystemSection system={snapshot.system} />
      <SessionSection sessions={snapshot.sessions} />
    </div>
  );
}
