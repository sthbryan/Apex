import cn from "cnfast";
import { useEffect, useState } from "preact/hooks";
import { NotifyPanel } from "@/features/notifications/NotifyPanel";
import { markAllRead, notices, unread } from "@/features/notifications/state";
import { notifyEnabled } from "@/features/settings/agentMode";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function NotifyChip() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      markAllRead();
    }
  }, [open]);

  if (notices.value.length === 0 && notifyEnabled.value) {
    return null;
  }

  return (
    <NotifyPanel
      open={open}
      onClose={() => setOpen(false)}
      anchor={
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
          {unread.value > 0 && <span class="text-xs tabular-nums">{unread.value}</span>}
        </button>
      }
    />
  );
}
