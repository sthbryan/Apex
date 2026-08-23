import type { QuotaWindow } from "@/bindings/QuotaWindow";
import { t } from "@/shared/i18n";

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

export function resetIn(window: QuotaWindow): string | null {
  if (!window.resets_at) {
    return null;
  }
  const when = new Date(window.resets_at);
  return Number.isNaN(when.getTime()) ? null : countdown((when.getTime() - Date.now()) / 1000);
}

export function pacing(window: QuotaWindow): { text: string; tone: string } | null {
  if (window.lasts_to_reset === null) {
    return null;
  }
  if (window.lasts_to_reset) {
    return { text: t("usage.onPace"), tone: "text-state-done" };
  }
  const away = window.eta_seconds !== null ? countdown(window.eta_seconds) : null;
  return { text: away ?? t("usage.overPace"), tone: "text-state-blocked" };
}

export function tone(percent: number): { text: string; bar: string } {
  if (percent >= 90) {
    return { text: "text-state-failed", bar: "bg-state-failed" };
  }
  if (percent >= 70) {
    return { text: "text-state-blocked", bar: "bg-state-blocked" };
  }
  return { text: "text-muted", bar: "bg-muted" };
}

function clock(when: Date): string {
  const sameDay = when.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(undefined, {
    weekday: sameDay ? undefined : "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(when);
}

export function countdown(seconds: number): string | null {
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

export function roughly(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const days = Math.floor(seconds / 86400);
  if (days > 0) {
    return `${days}d`;
  }
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${Math.max(1, Math.floor(seconds / 60))}m`;
}
