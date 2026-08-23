import { Meter } from "@apex/ui";
import type { SystemUsage } from "@/bindings/SystemUsage";
import { barTone } from "@/features/usage/tone";
import { t } from "@/shared/i18n";
import { compactBytes, percentOf } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  system: SystemUsage;
};

export function SystemSection({ system }: Props) {
  return (
    <section class="flex flex-col gap-0.5 py-1">
      <header class="mb-0.5 flex items-baseline gap-1">
        <h3 class="text-xs uppercase tracking-wider text-faint">{t("resources.system")}</h3>
        <span class="truncate text-2xs text-faint">
          {t("resources.cores", { count: String(system.cores) })}
        </span>
      </header>
      <Meter
        lead={<Icon name="cpu" />}
        label={t("resources.cpu")}
        value={system.cpu_percent}
        tone={barTone(system.cpu_percent)}
      />
      {system.gpu_percent !== null && (
        <Meter
          lead={<Icon name="gpu" />}
          label={t("resources.gpu")}
          value={system.gpu_percent}
          tone={barTone(system.gpu_percent)}
        />
      )}
      <Meter
        lead={<Icon name="memory" />}
        label={t("resources.memory")}
        value={percentOf(system.memory_used, system.memory_total)}
        tone={barTone(percentOf(system.memory_used, system.memory_total))}
        detail={`${compactBytes(system.memory_used)}/${compactBytes(system.memory_total)}`}
      />
      {system.swap_total > 0 && (
        <Meter
          lead={<Icon name="swap" />}
          label={t("resources.swap")}
          value={percentOf(system.swap_used, system.swap_total)}
          tone={barTone(percentOf(system.swap_used, system.swap_total))}
          detail={`${compactBytes(system.swap_used)}/${compactBytes(system.swap_total)}`}
        />
      )}
    </section>
  );
}
