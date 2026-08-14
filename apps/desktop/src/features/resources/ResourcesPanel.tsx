import type { MetricsSnapshot } from "@/bindings/MetricsSnapshot";
import { Meter } from "@/features/resources/Meter";
import { focusSession } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { compactBytes, killProcess, percentOf } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  snapshot: MetricsSnapshot | null;
};

export function ResourcesPanel({ snapshot }: Props) {
  if (!snapshot) {
    return <p class="px-2 py-1.5 text-faint">{t("resources.sampling")}</p>;
  }

  const { system, sessions } = snapshot;

  return (
    <div class="flex max-h-96 flex-col overflow-y-auto">
      <div class="px-2 py-1.5">
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
            detail={compactBytes(system.swap_used)}
          />
        )}
      </div>

      <div class="border-t border-border px-2 py-1.5">
        <h2 class="mb-0.5 uppercase tracking-wider text-faint">{t("resources.bySession")}</h2>
        {sessions.length === 0 ? (
          <p class="text-faint">{t("resources.noSessions")}</p>
        ) : (
          <ul class="flex flex-col">
            {sessions.map((usage) => (
              <li key={usage.id} class="animate-row-in">
                <button
                  type="button"
                  onClick={() => focusSession(usage.id)}
                  class="flex w-full items-center gap-2 rounded px-1 text-left transition-colors hover:bg-raised"
                >
                  <span class="truncate">{usage.title}</span>
                  <span class="ml-auto shrink-0 text-muted">{compactBytes(usage.memory)}</span>
                  <span class="w-8 shrink-0 text-right text-faint">
                    {usage.cpu_percent.toFixed(0)}%
                  </span>
                </button>
                {usage.processes.slice(0, 3).map((process) => (
                  <div
                    key={process.pid}
                    class="group flex items-center gap-2 rounded px-1 pl-3 text-faint transition-colors hover:bg-raised"
                  >
                    <span class="truncate">{process.name}</span>
                    <span class="ml-auto shrink-0">{compactBytes(process.memory)}</span>
                    <button
                      type="button"
                      title={t("resources.kill", { pid: String(process.pid) })}
                      onClick={() => void killProcess(process.pid)}
                      class="w-8 shrink-0 opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-state-failed"
                    >
                      <Icon name="close" size={12} class="ml-auto" />
                    </button>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
