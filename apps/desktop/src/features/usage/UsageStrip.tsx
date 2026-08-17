import cn from "cnfast";
import type { QuotaReport } from "@/bindings/QuotaReport";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { resetText, tone } from "@/features/usage/format";
import { metrics } from "@/shared/telemetry";

const SHOWN_WINDOWS = 2;

export function UsageStrip() {
  const reports = (metrics.value?.quotas ?? []).filter((report) => report.windows.length > 0);
  if (reports.length === 0) {
    return null;
  }

  return (
    <div class="flex min-w-0 items-center gap-3">
      {reports.map((report) => (
        <Report key={report.agent} report={report} />
      ))}
    </div>
  );
}

function Report({ report }: { report: QuotaReport }) {
  return (
    <span class="flex min-w-0 items-center gap-1.5">
      <AgentIcon agent={report.agent} class="shrink-0 text-faint" />
      {report.windows.slice(0, SHOWN_WINDOWS).map((window) => {
        const percent = Math.min(100, Math.max(0, window.used_percent));
        const level = tone(percent);
        return (
          <span
            key={window.label ?? percent}
            class="flex shrink-0 items-center gap-1"
            title={resetText(window)}
          >
            <span class="block h-1 w-8 overflow-hidden rounded-full bg-border">
              <span
                class={cn("block h-full origin-left rounded-full", level.bar)}
                style={{ transform: `scaleX(${percent / 100})` }}
              />
            </span>
            <span class={cn("tabular-nums", level.text)}>{percent}%</span>
            {window.label && <span class="text-faint">{window.label}</span>}
          </span>
        );
      })}
    </span>
  );
}
