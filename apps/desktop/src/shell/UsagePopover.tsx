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
    <div class="w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
      <header class="flex items-center gap-2 border-b border-border px-3 py-2">
        <span class="font-semibold">{t("usage.title")}</span>
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

      <div class="max-h-96 overflow-y-auto p-3">
        {reports.length === 0 ? (
          <p class="text-faint">{t("resources.noQuota")}</p>
        ) : (
          reports.map((report) => (
            <section key={report.agent} class="mb-4 last:mb-0">
              <p class="mb-2 text-muted">{report.agent}</p>
              {report.windows.map((window) => (
                <Window key={window.label} window={window} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Window({ window }: { window: QuotaWindow }) {
  const percent = Math.min(100, Math.max(0, window.used_percent));

  return (
    <div class="mb-3 last:mb-0">
      <div class="flex items-baseline gap-2">
        <span class="text-faint">{windowName(window.label)}</span>
        <span class={`ml-auto text-lg ${tone(percent)}`}>{percent}%</span>
      </div>
      <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
        <div class={`h-full ${bar(percent)}`} style={{ width: `${percent}%` }} />
      </div>
      <p class="mt-1 text-faint">{resetText(window)}</p>
    </div>
  );
}

export function windowName(label: string): string {
  if (label.endsWith("h")) {
    return t("usage.rolling", { window: label });
  }
  if (label.endsWith("w") || label.endsWith("d")) {
    return t("usage.longRange", { window: label });
  }
  return label;
}

export function resetText(window: QuotaWindow): string {
  if (window.resets_at) {
    const when = new Date(window.resets_at);
    if (!Number.isNaN(when.getTime())) {
      return t("usage.resets", {
        when: new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(when),
      });
    }
  }
  return window.reset_description ?? "";
}

function tone(percent: number): string {
  if (percent >= 90) {
    return "text-state-failed";
  }
  if (percent >= 70) {
    return "text-state-blocked";
  }
  return "text-state-done";
}

function bar(percent: number): string {
  if (percent >= 90) {
    return "bg-state-failed";
  }
  if (percent >= 70) {
    return "bg-state-blocked";
  }
  return "bg-state-done";
}
