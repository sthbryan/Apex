import type { ApexUsage } from "@/bindings/ApexUsage";
import type { SystemUsage } from "@/bindings/SystemUsage";
import { Meter } from "@/features/resources/Meter";
import { t } from "@/shared/i18n";
import { compactBytes, percentOf } from "@/shared/telemetry";

type Props = {
  apex: ApexUsage;
  system: SystemUsage;
};

export function ApexSection({ apex, system }: Props) {
  return (
    <section class="px-2.5 py-1">
      <header class="mb-0.5 flex items-baseline gap-1">
        <h3 class="text-micro uppercase tracking-wider text-faint">{t("resources.apex")}</h3>
        <span class="truncate text-[10px] text-faint">{t("resources.apexHint")}</span>
      </header>
      <Meter icon="sparkles" label={t("resources.cpu")} percent={apex.cpu_percent} />
      <Meter
        icon="memory"
        label={t("resources.memory")}
        percent={percentOf(apex.memory, system.memory_total)}
        detail={`${compactBytes(apex.memory)}/${compactBytes(system.memory_total)}`}
      />
    </section>
  );
}
