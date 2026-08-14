import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

import { t } from "../i18n";
import { formatBytes, metrics, percentOf } from "../metrics";
import { ResourcesPanel } from "../panels/ResourcesPanel";
import { UsagePopover } from "./UsagePopover";

type Popover = "usage" | "resources" | null;

const popover = signal<Popover>(null);

export function toggleUsagePopover(): void {
  popover.value = popover.value === "usage" ? null : "usage";
}

export function StatusBar() {
  const open = popover.value;
  const setOpen = (next: Popover | ((current: Popover) => Popover)) => {
    popover.value = typeof next === "function" ? next(popover.value) : next;
  };
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(null);
      }
    };
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  const snapshot = metrics.value;
  if (!snapshot) {
    return null;
  }

  const memory = percentOf(snapshot.system.memory_used, snapshot.system.memory_total);

  return (
    <div
      ref={holder}
      class="relative flex h-6 shrink-0 items-center gap-3 border-t border-border bg-surface px-2 text-faint"
    >
      {open === "usage" && (
        <div class="absolute bottom-full left-1 mb-1 z-50">
          <UsagePopover reports={snapshot.quotas} onClose={() => setOpen(null)} />
        </div>
      )}
      {open === "resources" && (
        <div class="absolute bottom-full right-1 mb-1 z-50 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
          <ResourcesPanel snapshot={snapshot} />
        </div>
      )}

      {snapshot.quotas.map((report) => (
        <button
          key={report.agent}
          type="button"
          onClick={() => setOpen((current) => (current === "usage" ? null : "usage"))}
          class="flex items-center gap-1.5 rounded px-1 hover:bg-raised hover:text-muted"
        >
          <span>{report.agent}</span>
          <Bar percent={report.windows[0]?.used_percent ?? 0} />
          <span>
            {report.windows
              .map((window) =>
                window.label ? `${window.used_percent}% ${window.label}` : `${window.used_percent}%`,
              )
              .join(" · ")}
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setOpen((current) => (current === "resources" ? null : "resources"))}
        class="ml-auto flex items-center gap-3 rounded px-1 hover:bg-raised hover:text-muted"
      >
        <span title={t("resources.memory")}>{formatBytes(snapshot.system.memory_used)}</span>
        <span title={t("resources.cpu")}>
          {t("status.cpu", { percent: snapshot.system.cpu_percent.toFixed(0) })}
        </span>
        {snapshot.system.gpu_percent !== null && (
          <span title={t("resources.gpu")}>
            {t("status.gpu", { percent: snapshot.system.gpu_percent.toFixed(0) })}
          </span>
        )}
        <span title={t("resources.bySession")}>
          {t("status.sessions", { count: String(snapshot.sessions.length) })}
        </span>
        <Bar percent={memory} />
      </button>
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <span class="inline-block h-1 w-8 overflow-hidden rounded-full bg-border align-middle">
      <span class={`block h-full ${tone(clamped)}`} style={{ width: `${clamped}%` }} />
    </span>
  );
}

function tone(percent: number): string {
  if (percent >= 90) {
    return "bg-state-failed";
  }
  if (percent >= 70) {
    return "bg-state-blocked";
  }
  return "bg-state-working";
}
