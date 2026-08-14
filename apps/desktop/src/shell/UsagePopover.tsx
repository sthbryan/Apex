import type { QuotaReport } from "../bindings/QuotaReport";
import type { QuotaWindow } from "../bindings/QuotaWindow";
import { t } from "../i18n";
import { refreshQuota } from "../metrics";

type Props = {
  reports: QuotaReport[];
  onClose: () => void;
};

export function UsagePopover({ reports, onClose }: Props) {
  return (
    <div class="w-[22rem] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
      {reports.length === 0 ? (
        <p class="p-4 text-faint">{t("resources.noQuota")}</p>
      ) : (
        reports.map((report) => (
          <section key={report.agent} class="border-b border-border last:border-0">
            <header class="flex items-center gap-2 px-4 pt-3">
              <span class="text-muted">{report.agent}</span>
              <button
                type="button"
                title={t("resources.refresh")}
                onClick={() => void refreshQuota()}
                class="ml-auto text-faint hover:text-text"
              >
                ↻
              </button>
              <button type="button" onClick={onClose} class="text-faint hover:text-text">
                ×
              </button>
            </header>

            <div class="flex flex-col gap-2 p-3">
              {report.windows.map((window, index) => (
                <Card key={window.label} window={window} primary={index === 0} />
              ))}
            </div>

            {report.updated_at && (
              <p class="px-4 pb-3 text-faint">
                {t("usage.updated", { when: relative(report.updated_at) })}
              </p>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function Card({ window, primary }: { window: QuotaWindow; primary: boolean }) {
  const percent = Math.min(100, Math.max(0, window.used_percent));
  const level = tone(percent);
  const pace = pacing(window);

  return (
    <div class="rounded-lg bg-raised p-3">
      <div class="flex items-start gap-2">
        <div class="min-w-0">
          <p class="text-text">{primary ? t("usage.session") : t("usage.weekly")}</p>
          <p class="text-faint">{t("usage.window", { window: window.label })}</p>
        </div>
        <span class={`ml-auto shrink-0 text-2xl leading-none ${level.text}`}>{percent}%</span>
      </div>

      <div class="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-border">
        <div class={`h-full rounded-full ${level.bar}`} style={{ width: `${percent}%` }} />
        {window.expected_percent !== null && (
          <span
            title={t("usage.expected", { percent: String(window.expected_percent) })}
            class="absolute top-0 h-full w-px bg-text/40"
            style={{ left: `${Math.min(100, Math.max(0, window.expected_percent))}%` }}
          />
        )}
      </div>

      <p class="mt-2 truncate text-faint">{resetText(window)}</p>
      {pace && <p class={`mt-0.5 ${pace.tone}`}>{pace.text}</p>}
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
    return { text: `✓ ${t("usage.onTrack")}`, tone: "text-faint" };
  }
  const away = window.eta_seconds !== null ? countdown(window.eta_seconds) : null;
  return {
    text: `▲ ${away ? t("usage.emptyIn", { away }) : t("usage.overPace")}`,
    tone: "text-state-blocked",
  };
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
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
}

function relative(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    return iso;
  }
  const away = countdown((Date.now() - when.getTime()) / 1000);
  return away ?? t("usage.justNow");
}
