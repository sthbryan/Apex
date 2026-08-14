import { useEffect, useRef, useState } from "preact/hooks";

import { usePresence } from "../components/presence";
import { t } from "../i18n";
import { compactBytes, metrics } from "../metrics";
import { ResourcesPanel } from "../panels/ResourcesPanel";
import cn from "cnfast";

export function StatusBar() {
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
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
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

  return (
    <div
      ref={holder}
      class={cn("relative flex h-6 shrink-0 items-center justify-end gap-3 border-t border-border bg-surface px-2 text-faint")}
    >
      {popover.mounted && (
        <div
          ref={popover.holder}
          class={cn("absolute bottom-full right-1 z-50 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl", {
            "animate-rise-out": popover.leaving,
            "animate-rise-in": !popover.leaving,
          })}
        >
          <ResourcesPanel snapshot={snapshot} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        class={cn("flex items-center gap-2.5 rounded px-1 transition-colors hover:bg-raised hover:text-muted")}
      >
        <span title={t("resources.memory")}>{compactBytes(snapshot.system.memory_used)}</span>
        <span title={t("resources.cpu")}>{snapshot.system.cpu_percent.toFixed(0)}% cpu</span>
        {snapshot.system.gpu_percent !== null && (
          <span title={t("resources.gpu")}>{snapshot.system.gpu_percent.toFixed(0)}% gpu</span>
        )}
        <span title={t("resources.bySession")}>
          {t("status.sessions", { count: String(snapshot.sessions.length) })}
        </span>
      </button>
    </div>
  );
}
