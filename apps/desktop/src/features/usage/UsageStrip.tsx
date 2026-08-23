import cn from "cnfast";
import type { QuotaReport } from "@/bindings/QuotaReport";
import type { QuotaWindow } from "@/bindings/QuotaWindow";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { resetText, tone } from "@/features/usage/format";
import { toggleUsagePopover, usageOpen } from "@/features/usage/state";
import { UsagePopover } from "@/features/usage/UsagePopover";
import { t } from "@/shared/i18n";
import { metrics } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

const SHOWN = 2;

type Entry = { agent: string; window: QuotaWindow };

export function UsageStrip() {
  const reports = (metrics.value?.quotas ?? []).filter((report) => report.windows.length > 0);

  const failures = metrics.value?.quota_failures ?? [];
  if (reports.length === 0 && failures.length === 0) {
    return null;
  }

  const entries = tightest(reports);
  const shown = entries.slice(0, SHOWN);
  const hidden = entries.length - shown.length;

  return (
    <UsagePopover
      open={usageOpen.value}
      reports={reports}
      failures={failures}
      onClose={() => {
        usageOpen.value = false;
      }}
      anchor={
        <button
          type="button"
          title={t("usage.title")}
          onClick={toggleUsagePopover}
          class="flex h-5 items-center gap-2 rounded px-1 transition-colors hover:bg-raised"
        >
          {shown.map((entry) => (
            <Chip key={`${entry.agent}:${entry.window.label ?? ""}`} entry={entry} />
          ))}
          {hidden > 0 && <span class="shrink-0 text-faint">+{hidden}</span>}
          {failures.length > 0 && (
            <Icon size={11} name="activity" class="shrink-0 text-state-failed" />
          )}
        </button>
      }
    />
  );
}

function Chip({ entry }: { entry: Entry }) {
  const percent = Math.min(100, Math.max(0, entry.window.used_percent));
  const level = tone(percent);

  return (
    <span class="flex shrink-0 items-center gap-1.5" title={resetText(entry.window)}>
      <AgentIcon agent={entry.agent} class="shrink-0 text-faint" />
      <span class="h-1 w-6 shrink-0 overflow-hidden rounded-full bg-raised">
        <span class={cn("block h-full rounded-full", level.bar)} style={{ width: `${percent}%` }} />
      </span>
      <span class={cn("tabular-nums", level.text)}>{percent}%</span>
      {entry.window.label && <span class="text-muted">{entry.window.label}</span>}
    </span>
  );
}

function tightest(reports: QuotaReport[]): Entry[] {
  return reports
    .map((report) => ({
      agent: report.agent,
      window: report.windows.reduce((tight, window) =>
        window.used_percent > tight.used_percent ? window : tight,
      ),
    }))
    .sort((left, right) => right.window.used_percent - left.window.used_percent);
}
