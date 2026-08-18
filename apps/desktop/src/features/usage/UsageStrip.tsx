import cn from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";
import type { QuotaReport } from "@/bindings/QuotaReport";
import type { QuotaWindow } from "@/bindings/QuotaWindow";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { resetText, tone } from "@/features/usage/format";
import { UsagePopover } from "@/features/usage/UsagePopover";
import { t } from "@/shared/i18n";
import { metrics } from "@/shared/telemetry";
import { usePresence } from "@/shared/ui/presence";

const SHOWN = 2;

type Entry = { agent: string; window: QuotaWindow };

export function UsageStrip() {
  const holder = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const popover = usePresence<HTMLDivElement>(open);
  const reports = (metrics.value?.quotas ?? []).filter((report) => report.windows.length > 0);

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", dismiss);
    return () => window.removeEventListener("mousedown", dismiss);
  }, [open]);

  if (reports.length === 0) {
    return null;
  }

  const entries = tightest(reports);
  const shown = entries.slice(0, SHOWN);
  const hidden = entries.length - shown.length;

  return (
    <div
      ref={holder}
      class="relative flex min-w-0 items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        title={t("usage.title")}
        onClick={() => setOpen((value) => !value)}
        class="flex h-5 items-center gap-2 rounded px-1 transition-colors hover:bg-raised"
      >
        {shown.map((entry) => (
          <Chip key={`${entry.agent}:${entry.window.label ?? ""}`} entry={entry} />
        ))}
        {hidden > 0 && <span class="shrink-0 text-faint">+{hidden}</span>}
      </button>

      {popover.mounted && (
        <div
          ref={popover.holder}
          class={cn("absolute bottom-full left-0 z-50 mb-1 origin-bottom-left", {
            "animate-drop-out": popover.leaving,
            "animate-drop-in": !popover.leaving,
          })}
        >
          <UsagePopover reports={reports} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function Chip({ entry }: { entry: Entry }) {
  const percent = Math.min(100, Math.max(0, entry.window.used_percent));
  const level = tone(percent);

  return (
    <span class="flex shrink-0 items-center gap-1" title={resetText(entry.window)}>
      <AgentIcon agent={entry.agent} class="shrink-0 text-faint" />
      <span class={cn("tabular-nums", level.text)}>{percent}%</span>
      {entry.window.label && <span class="text-faint">{entry.window.label}</span>}
    </span>
  );
}

function tightest(reports: QuotaReport[]): Entry[] {
  return reports
    .flatMap((report) => report.windows.map((window) => ({ agent: report.agent, window })))
    .sort((left, right) => right.window.used_percent - left.window.used_percent);
}
