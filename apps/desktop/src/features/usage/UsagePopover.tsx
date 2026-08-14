import { useState } from "preact/hooks";
import type { QuotaReport } from "@/bindings/QuotaReport";
import { UsageRow } from "@/features/usage/UsageRow";
import { t } from "@/shared/i18n";
import { refreshQuota } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  reports: QuotaReport[];
  onClose: () => void;
};

export function UsagePopover({ reports, onClose }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  return (
    <div class="w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
      <header class="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
        <span class="text-muted">{t("usage.title")}</span>
        <button
          type="button"
          title={t("resources.refresh")}
          onClick={() => {
            setRefreshing(true);
            void refreshQuota().finally(() => setRefreshing(false));
          }}
          class="ml-auto text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" class={refreshing ? "animate-spin" : ""} />
        </button>
        <button type="button" onClick={onClose} class="text-faint hover:text-text">
          <Icon name="close" />
        </button>
      </header>

      <div class="max-h-80 overflow-y-auto py-1">
        {reports.length === 0 ? (
          <p class="px-2.5 py-2 text-faint">{t("resources.noQuota")}</p>
        ) : (
          reports.map((report) => (
            <section key={report.agent} class="px-2.5 py-1">
              <p class="text-faint">{report.agent}</p>
              {report.windows.map((window, index) => (
                <UsageRow key={window.label ?? index} window={window} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
