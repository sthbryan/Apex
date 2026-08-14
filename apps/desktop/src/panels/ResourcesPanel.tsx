import type { MetricsSnapshot } from "../bindings/MetricsSnapshot";
import { t } from "../i18n";
import { formatBytes, killProcess, percentOf } from "../metrics";
import { focusSession } from "../shell/workspace";

type Props = {
  snapshot: MetricsSnapshot | null;
};

export function ResourcesPanel({ snapshot }: Props) {
  if (!snapshot) {
    return <p class="p-2 text-faint">{t("resources.sampling")}</p>;
  }

  const { system, sessions } = snapshot;

  return (
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-2">
      <section>
        <h2 class="mb-1 px-1 uppercase tracking-wider text-faint">{t("resources.system")}</h2>
        <Meter label={t("resources.cpu")} percent={system.cpu_percent} detail={`${system.cores} ${t("resources.cores")}`} />
        {system.gpu_percent !== null && (
          <Meter label={t("resources.gpu")} percent={system.gpu_percent} />
        )}
        <Meter
          label={t("resources.memory")}
          percent={percentOf(system.memory_used, system.memory_total)}
          detail={`${formatBytes(system.memory_used)} / ${formatBytes(system.memory_total)}`}
        />
        {system.swap_total > 0 && (
          <Meter
            label={t("resources.swap")}
            percent={percentOf(system.swap_used, system.swap_total)}
            detail={formatBytes(system.swap_used)}
          />
        )}
      </section>

      <section>
        <h2 class="mb-1 px-1 uppercase tracking-wider text-faint">{t("resources.bySession")}</h2>
        {sessions.length === 0 ? (
          <p class="px-1 text-faint">{t("resources.noSessions")}</p>
        ) : (
          <ul class="flex flex-col gap-2">
            {sessions.map((usage) => (
              <li key={usage.id}>
                <button
                  type="button"
                  onClick={() => focusSession(usage.id)}
                  class="flex w-full items-baseline gap-2 rounded px-1 text-left hover:bg-raised"
                >
                  <span class="truncate">{usage.title}</span>
                  <span class="ml-auto shrink-0 text-muted">{formatBytes(usage.memory)}</span>
                  <span class="w-12 shrink-0 text-right text-faint">
                    {usage.cpu_percent.toFixed(0)}%
                  </span>
                </button>
                <ul class="mt-0.5 flex flex-col">
                  {usage.processes.slice(0, 4).map((process) => (
                    <li
                      key={process.pid}
                      class="group flex items-baseline gap-2 rounded px-1 pl-3 text-faint hover:bg-raised"
                    >
                      <span class="truncate">{process.name}</span>
                      <span class="ml-auto shrink-0">{formatBytes(process.memory)}</span>
                      <button
                        type="button"
                        title={t("resources.kill", { pid: String(process.pid) })}
                        onClick={() => void killProcess(process.pid)}
                        class="shrink-0 opacity-0 group-hover:opacity-100 hover:text-state-failed"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}

function Meter({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number;
  detail?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div class="px-1 py-0.5">
      <div class="flex items-baseline gap-2">
        <span class="text-muted">{label}</span>
        <span class="ml-auto shrink-0 text-faint">{clamped.toFixed(0)}%</span>
      </div>
      <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-border">
        <div class={`h-full ${barTone(clamped)}`} style={{ width: `${clamped}%` }} />
      </div>
      {detail && <p class="mt-0.5 truncate text-faint">{detail}</p>}
    </div>
  );
}

function barTone(percent: number): string {
  if (percent >= 90) {
    return "bg-state-failed";
  }
  if (percent >= 70) {
    return "bg-state-blocked";
  }
  return "bg-state-working";
}
