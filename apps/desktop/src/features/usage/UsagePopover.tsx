import { Popover } from "@apex/ui";
import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { QuotaReport } from "@/bindings/QuotaReport";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { countdown, tone } from "@/features/usage/format";
import { UsageRow } from "@/features/usage/UsageRow";
import { t } from "@/shared/i18n";
import { refreshQuota } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  open: boolean;
  reports: QuotaReport[];
  failures: string[];
  anchor: ComponentChildren;
  onClose: () => void;
};

export function UsagePopover({ open, reports, failures, anchor, onClose }: Props) {
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
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      side="top"
      align="start"
      width={288}
      label={t("usage.title")}
      title={
        <>
          <Icon name="activity" size={12} class="text-faint" />
          {t("usage.title")}
        </>
      }
      meta={updatedAgo ? t("usage.updatedAgo", { away: updatedAgo }) : undefined}
      actions={
        <button
          type="button"
          title={t("resources.refresh")}
          onClick={() => {
            setRefreshing(true);
            void refreshQuota().finally(() => setRefreshing(false));
          }}
          class="text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} class={refreshing ? "animate-spin" : ""} />
        </button>
      }
    >
      <div class="-mx-1">
        {failures.map((agent) => (
          <section key={agent} class="flex items-center gap-1.5 px-1 py-1">
            <AgentIcon agent={agent} class="shrink-0 text-faint" />
            <h3 class="text-micro uppercase tracking-wider text-faint">{agent}</h3>
            <span class="ml-auto shrink-0 text-micro text-state-failed">
              {t("usage.unavailable")}
            </span>
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                void refreshQuota().finally(() => setRefreshing(false));
              }}
              class="shrink-0 text-micro text-faint underline transition-colors hover:text-text"
            >
              {t("usage.retry")}
            </button>
          </section>
        ))}
        {reports.length === 0 && failures.length === 0 ? (
          <p class="px-1 py-1 text-faint">{t("resources.noQuota")}</p>
        ) : (
          reports.map((report) => {
            const tight = Math.max(...report.windows.map((window) => window.used_percent));
            const level = tone(tight);
            return (
              <section key={report.agent} class="px-1 py-1">
                <div class="mb-0.5 flex items-center gap-1.5">
                  <AgentIcon agent={report.agent} class="shrink-0 text-faint" />
                  <h3 class="text-micro uppercase tracking-wider text-faint">{report.agent}</h3>
                  <span class={cn("ml-auto shrink-0 text-micro font-medium", level.text)}>
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
    </Popover>
  );
}
