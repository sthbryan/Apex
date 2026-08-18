import cn from "cnfast";
import { useState } from "preact/hooks";
import type { QuotaReport } from "@/bindings/QuotaReport";
import { countdown, tone } from "@/features/usage/format";
import { UsageRow } from "@/features/usage/UsageRow";
import { t } from "@/shared/i18n";
import { refreshQuota } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  reports: QuotaReport[];
  failures: string[];
  onClose: () => void;
};

export function UsagePopover({ reports, failures, onClose }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const updatedAgo = reports.some((report) => report.updated_at)
    ? countdown(
        (Date.now() -
          new Date(
            Math.max(...reports.map((report) => new Date(report.updated_at ?? 0).getTime())),
          ).getTime()) /
          1000,
      )
    : null;

  return (
    <div class="w-72 overflow-hidden rounded-lg border border-border bg-overlay shadow-2xl">
      <header class="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
        <Icon name="activity" size={12} class="text-faint" />
        <span class="truncate text-[12px] font-medium text-text">{t("usage.title")}</span>
        {updatedAgo && (
          <span class="shrink-0 text-[10px] text-faint">
            {t("usage.updatedAgo", { away: updatedAgo })}
          </span>
        )}
        <button
          type="button"
          title={t("resources.refresh")}
          onClick={() => {
            setRefreshing(true);
            void refreshQuota().finally(() => setRefreshing(false));
          }}
          class="ml-auto text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} class={refreshing ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={onClose}
          class="text-faint transition-colors hover:text-text"
        >
          <Icon name="close" size={12} />
        </button>
      </header>

      <div class="max-h-80 overflow-y-auto py-1">
        {failures.map((agent) => (
          <section key={agent} class="flex items-baseline gap-1 px-2.5 py-1">
            <h3 class="text-micro uppercase tracking-wider text-faint">{agent}</h3>
            <span class="ml-auto shrink-0 text-[11px] text-state-failed">
              {t("usage.unavailable")}
            </span>
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                void refreshQuota().finally(() => setRefreshing(false));
              }}
              class="shrink-0 text-[11px] text-faint underline transition-colors hover:text-text"
            >
              {t("usage.retry")}
            </button>
          </section>
        ))}
        {reports.length === 0 && failures.length === 0 ? (
          <p class="px-2.5 py-2 text-faint">{t("resources.noQuota")}</p>
        ) : (
          reports.map((report) => {
            const tight = Math.max(...report.windows.map((window) => window.used_percent));
            const level = tone(tight);
            return (
              <section key={report.agent} class="px-2.5 py-1">
                <div class="mb-0.5 flex items-baseline gap-1">
                  <h3 class="text-micro uppercase tracking-wider text-faint">{report.agent}</h3>
                  <span class={cn("ml-auto shrink-0 text-[11px] font-medium", level.text)}>
                    {tight}%
                  </span>
                </div>
                {report.windows.map((window, index) => (
                  <UsageRow key={window.label ?? index} window={window} />
                ))}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
