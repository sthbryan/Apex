import { Meter } from "@apex/ui";
import type { ApexUsage } from "@/bindings/ApexUsage";
import type { SystemUsage } from "@/bindings/SystemUsage";
import { barTone } from "@/features/resources/tone";
import { t } from "@/shared/i18n";
import { compactBytes, percentOf } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  apex: ApexUsage;
  system: SystemUsage;
};

export function ApexSection({ apex, system }: Props) {
  return (
    <section class="flex flex-col gap-0.5 py-1">
      <header class="mb-0.5 flex items-baseline gap-1">
        <h3 class="text-xs uppercase tracking-wider text-faint">{t("resources.apex")}</h3>
        <span class="truncate text-2xs text-faint">{t("resources.apexHint")}</span>
      </header>
      <Meter
        lead={<Icon name="sparkles" />}
        label={t("resources.cpu")}
        value={apex.cpu_percent}
        tone={barTone(apex.cpu_percent)}
      />
      <Meter
        lead={<Icon name="memory" />}
        label={t("resources.memory")}
        value={percentOf(apex.memory, system.memory_total)}
        tone={barTone(percentOf(apex.memory, system.memory_total))}
        detail={`${compactBytes(apex.memory)}/${compactBytes(system.memory_total)}`}
      />
    </section>
  );
}
