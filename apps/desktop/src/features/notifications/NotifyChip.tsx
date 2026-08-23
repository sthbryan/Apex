import { Badge, StatusPill } from "@apex/ui";
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
        <StatusPill title={t("notify.title")} onClick={() => setOpen((current) => !current)}>
          <Icon name={notifyEnabled.value ? "bell" : "bellOff"} size={11} />
          {unread.value > 0 && <Badge tone="accent">{unread.value}</Badge>}
        </StatusPill>
      }
    />
  );
}
