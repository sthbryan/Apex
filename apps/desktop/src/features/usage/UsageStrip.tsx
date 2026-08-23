import { Bar, StatusPill } from "@apex/ui";
import type { QuotaReport } from "@/bindings/QuotaReport";
import type { QuotaWindow } from "@/bindings/QuotaWindow";
import { resetText } from "@/features/usage/format";
import { toggleUsagePopover, usageOpen } from "@/features/usage/state";
import { barTone } from "@/features/usage/tone";
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
  const loudest = shown[0]?.window.used_percent ?? 0;

  return (
    <UsagePopover
      open={usageOpen.value}
      reports={reports}
      failures={failures}
      onClose={() => {
        usageOpen.value = false;
      }}
      anchor={
        <StatusPill title={t("usage.title")} onClick={toggleUsagePopover}>
          {shown.map((entry) => (
            <Bar
              key={`${entry.agent}:${entry.window.label ?? ""}`}
              class="w-9"
              size="sm"
              value={entry.window.used_percent}
              tone={barTone(entry.window.used_percent)}
              label={`${entry.agent} ${entry.window.label ?? ""}`.trim()}
              title={resetText(entry.window)}
            />
          ))}
          <span class="font-mono tabular-nums">{loudest}%</span>
          {hidden > 0 && <span class="text-faint">+{hidden}</span>}
          {failures.length > 0 && <Icon size={11} name="activity" class="text-state-failed" />}
        </StatusPill>
      }
    />
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
