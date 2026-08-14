import type { SystemUsage } from "@/bindings/SystemUsage";
import { Meter } from "@/features/resources/Meter";
import { t } from "@/shared/i18n";
import { compactBytes, percentOf } from "@/shared/telemetry";

type Props = {
  system: SystemUsage;
};

export function SystemSection({ system }: Props) {
  return (
    <section class="px-2 py-1.5">
      <header class="mb-0.5 flex items-baseline gap-1">
        <h3 class="text-micro uppercase tracking-wider text-faint">{t("resources.system")}</h3>
        <span class="text-faint">·</span>
        <span class="text-faint">{t("resources.cores", { count: String(system.cores) })}</span>
      </header>
      <Meter icon="cpu" label={t("resources.cpu")} percent={system.cpu_percent} />
      {system.gpu_percent !== null && (
        <Meter icon="gpu" label={t("resources.gpu")} percent={system.gpu_percent} />
      )}
      <Meter
        icon="memory"
        label={t("resources.memory")}
        percent={percentOf(system.memory_used, system.memory_total)}
        detail={`${compactBytes(system.memory_used)}/${compactBytes(system.memory_total)}`}
      />
      {system.swap_total > 0 && (
        <Meter
          icon="swap"
          label={t("resources.swap")}
          percent={percentOf(system.swap_used, system.swap_total)}
          detail={`${compactBytes(system.swap_used)}/${compactBytes(system.swap_total)}`}
        />
      )}
    </section>
  );
}
