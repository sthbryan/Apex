import type { MetricsSnapshot } from "../bindings/MetricsSnapshot";
import { Icon, type IconName } from "../components/Icon";
import { t } from "../i18n";
import { compactBytes, killProcess, percentOf } from "../metrics";
import { focusSession } from "../shell/workspace";

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

function Meter({
  icon,
  label,
  percent,
  detail,
}: {
  icon: IconName;
  label: string;
  percent: number;
  detail?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div class="flex items-center gap-2 py-0.5" title={label}>
      <Icon name={icon} class="shrink-0 text-muted" />
      <span class={`w-9 shrink-0 text-right ${toneText(clamped)}`}>{clamped.toFixed(0)}%</span>
      <span class="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <span
          class={`block h-full origin-left rounded-full transition-transform duration-500 ease-out ${toneBar(clamped)}`}
          style={{ transform: `scaleX(${clamped / 100})` }}
        />
      </span>
      <span class="w-18 shrink-0 truncate text-right text-faint">{detail ?? ""}</span>
    </div>
  );
}

function toneBar(percent: number): string {
  if (percent >= 90) {
    return "bg-state-failed";
  }
  if (percent >= 70) {
    return "bg-state-blocked";
  }
  return "bg-state-working";
}

function toneText(percent: number): string {
  return percent >= 90 ? "text-state-failed" : "text-muted";
}
