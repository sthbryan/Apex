import { type AgentState, Notice as Banner, Button, Dot, ListRow, Popover } from "@apex/ui";
import type { ComponentChildren } from "preact";
import type { Notice } from "@/features/notifications/state";
import {
  askForPermission,
  forgetNotices,
  notices,
  permitted,
} from "@/features/notifications/state";
import { sessions } from "@/features/sessions/state";
import { roughly } from "@/features/usage/format";
import { focusSession, openInNewTab } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  open: boolean;
  anchor: ComponentChildren;
  onClose: () => void;
};

export function NotifyPanel({ open, anchor, onClose }: Props) {
  const latest = [...notices.value].reverse();

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      side="top"
      align="end"
      width={320}
      label={t("notify.title")}
      title={t("notify.title")}
      actions={
        <Button
          variant="subtle"
          size="xs"
          iconOnly
          title={t("notify.clear")}
          aria-label={t("notify.clear")}
          onClick={forgetNotices}
        >
          <Icon name="stop" size={11} />
        </Button>
      }
    >
      {!permitted.value && (
        <Banner
          tone="blocked"
          lead={<Icon name="bellOff" size={12} />}
          actions={
            <Button variant="subtle" size="xs" onClick={() => void askForPermission()}>
              {t("notify.allow")}
            </Button>
          }
        >
          {t("notify.denied")}
        </Banner>
      )}

      {latest.length === 0 ? (
        <p class="px-1 py-1 text-faint">{t("notify.empty")}</p>
      ) : (
        latest.map((notice) => <NoticeRow key={notice.id} notice={notice} />)
      )}
    </Popover>
  );
}

function NoticeRow({ notice }: { notice: Notice }) {
  const session = sessions.value.find((candidate) => candidate.id === notice.sessionId);
  const ago = roughly((Date.now() - notice.at) / 1000) ?? t("sessions.justNow");

  return (
    <ListRow
      label={notice.title}
      sub={notice.body ?? undefined}
      class={notice.read ? "text-muted" : undefined}
      disabled={!session}
      lead={<Dot state={stateOf(notice)} />}
      trail={<span class="tabular-nums">{ago}</span>}
      onClick={() => {
        if (session && !focusSession(session.id)) {
          openInNewTab(session);
        }
      }}
    />
  );
}

function stateOf(notice: Notice): AgentState {
  switch (notice.kind) {
    case "blocked":
      return "blocked";
    case "done":
      return "done";
    case "error":
      return "failed";
    case "quota":
      return "blocked";
    default:
      return "idle";
  }
}
