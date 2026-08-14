import { cn } from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";
import { ResourcesPanel } from "@/features/resources/ResourcesPanel";
import { t } from "@/shared/i18n";
import { compactBytes, metrics } from "@/shared/telemetry";
import { Icon, type IconName } from "@/shared/ui/Icon";
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
    return null;
  }

  return (
    <div ref={holder} class="relative">
      {popover.mounted && (
        <div
          ref={popover.holder}
          class={cn(
            "absolute bottom-full right-1 z-50 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl",
            {
              "animate-rise-out": popover.leaving,
              "animate-rise-in": !popover.leaving,
            },
          )}
        >
          <ResourcesPanel snapshot={snapshot} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        class="flex items-center gap-3 rounded px-1 transition-colors hover:bg-raised hover:text-muted"
      >
        <Gauge
          icon="cpu"
          label={t("resources.cpu")}
          value={`${snapshot.system.cpu_percent.toFixed(0)}%`}
        />
        {snapshot.system.gpu_percent !== null && (
          <Gauge
            icon="gpu"
            label={t("resources.gpu")}
            value={`${snapshot.system.gpu_percent.toFixed(0)}%`}
          />
        )}
        <Gauge
          icon="memory"
          label={t("resources.memory")}
          value={compactBytes(snapshot.system.memory_used)}
        />
        <Gauge
          icon="sessions"
          label={t("resources.bySession")}
          value={String(snapshot.sessions.length)}
        />
      </button>
    </div>
  );
}

function Gauge({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <span class="flex items-center gap-1" title={label}>
      <Icon name={icon} size={12} />
      {value}
    </span>
  );
}
