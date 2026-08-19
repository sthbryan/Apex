import cn from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";
import { NotifyPanel } from "@/features/notifications/NotifyPanel";
import { markAllRead, notices, unread } from "@/features/notifications/state";
import { notifyEnabled } from "@/features/settings/agentMode";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";

export function NotifyChip() {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const popover = usePresence<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) {
      return;
    }
    markAllRead();
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

  if (notices.value.length === 0 && notifyEnabled.value) {
    return null;
  }

  return (
    <div ref={holder} class="relative">
      {popover.mounted && (
        <div
          ref={popover.holder}
          class={cn(
            "absolute right-0 bottom-[calc(100%+0.5rem)] z-50 w-80 overflow-hidden rounded-lg border border-border bg-float shadow-2xl",
            {
              "animate-rise-out": popover.leaving,
              "animate-rise-in": !popover.leaving,
            },
          )}
        >
          <NotifyPanel onClose={() => setOpen(false)} />
        </div>
      )}

      <button
        type="button"
        title={t("notify.title")}
        onClick={() => setOpen((current) => !current)}
        class={cn(
          "flex h-6 items-center gap-1 rounded px-1 transition-colors hover:bg-raised hover:text-muted",
          unread.value > 0 ? "text-text" : "text-faint",
        )}
      >
        <Icon name={notifyEnabled.value ? "bell" : "bellOff"} size={12} />
        {unread.value > 0 && <span class="text-micro tabular-nums">{unread.value}</span>}
      </button>
    </div>
  );
}
