import { cn } from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";
import { Gauge } from "@/features/resources/Gauge";
import { ResourcesPanel } from "@/features/resources/ResourcesPanel";
import { t } from "@/shared/i18n";
import { compactBytes, metrics } from "@/shared/telemetry";
import { usePresence } from "@/shared/ui/presence";

export function ResourcesSummary() {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const popover = usePresence<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const snapshot = metrics.value;
  if (!snapshot) {
    return <div />;
  }

  return (
    <div ref={holder} class="relative">
      {popover.mounted && (
        <div
          ref={popover.holder}
          class={cn(
            "absolute right-0 bottom-[calc(100%+0.5rem)] z-50 w-80 overflow-hidden rounded-lg border border-border bg-overlay",
            {
              "animate-rise-out": popover.leaving,
              "animate-rise-in": !popover.leaving,
            },
          )}
        >
          <ResourcesPanel snapshot={snapshot} onClose={() => setOpen(false)} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        class="flex items-center gap-3 rounded px-1 transition-colors hover:bg-raised hover:text-muted"
      >
        <Gauge
          icon="sparkles"
          value={`${snapshot.apex.cpu_percent.toFixed(0)}%`}
        />
        <Gauge
          icon="memory"
          value={compactBytes(snapshot.apex.memory)}
        />
      </button>
    </div>
  );
}
