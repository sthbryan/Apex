import cn from "cnfast";
import { useState } from "preact/hooks";
import type { QuotaReport } from "@/bindings/QuotaReport";
import type { QuotaWindow } from "@/bindings/QuotaWindow";
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
                <Row key={window.label ?? index} window={window} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Row({ window }: { window: QuotaWindow }) {
  const percent = Math.min(100, Math.max(0, window.used_percent));
  const level = tone(percent);
  const pace = pacing(window);

  return (
    <div class="flex items-center gap-2 py-0.5" title={resetText(window)}>
      <span class="w-6 shrink-0 text-faint">{window.label ?? "·"}</span>
      <span class={cn("w-9 shrink-0 text-right", level.text)}>{percent}%</span>

      <span class="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-border">
        <span
          class={cn(
            "block h-full origin-left rounded-full transition-transform duration-500 ease-out",
            level.bar,
          )}
          style={{ transform: `scaleX(${percent / 100})` }}
        />
        {window.expected_percent !== null && (
          <span
            class="absolute top-0 h-full w-px bg-text/40"
            style={{ left: `${Math.min(100, Math.max(0, window.expected_percent))}%` }}
          />
        )}
      </span>

      <span class={cn("w-12 shrink-0 truncate text-right", pace?.tone ?? "")}>
        {pace?.text ?? ""}
      </span>
    </div>
  );
}

export function resetText(window: QuotaWindow): string {
  if (!window.resets_at) {
    return window.reset_description ?? "";
  }
  const when = new Date(window.resets_at);
  if (Number.isNaN(when.getTime())) {
    return window.reset_description ?? "";
  }
  const away = countdown((when.getTime() - Date.now()) / 1000);
  return away
    ? t("usage.resetsIn", { away, when: clock(when) })
    : t("usage.resetsAt", { when: clock(when) });
}

function pacing(window: QuotaWindow): { text: string; tone: string } | null {
  if (window.lasts_to_reset === null) {
    return null;
  }
  if (window.lasts_to_reset) {
    return null;
  }
  const away = window.eta_seconds !== null ? countdown(window.eta_seconds) : null;
  return { text: away ?? t("usage.overPace"), tone: "text-state-blocked" };
}

function tone(percent: number): { text: string; bar: string } {
  if (percent >= 90) {
    return { text: "text-state-failed", bar: "bg-state-failed" };
  }
  if (percent >= 70) {
    return { text: "text-state-blocked", bar: "bg-state-blocked" };
  }
  return { text: "text-state-done", bar: "bg-state-done" };
}

function clock(when: Date): string {
  const sameDay = when.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(undefined, {
    weekday: sameDay ? undefined : "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(when);
}

function countdown(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
}
