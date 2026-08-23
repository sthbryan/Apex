import { ListRow, Popover } from "@apex/ui";
import type { ComponentChildren } from "preact";
import type { Notice } from "@/features/notifications/state";
import {
  askForPermission,
  forgetNotices,
  notices,
  permitted,
} from "@/features/notifications/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
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
      title={
        <>
          <Icon name="bell" size={12} class="text-faint" />
          {t("notify.title")}
        </>
      }
      actions={
        <button
          type="button"
          title={t("notify.clear")}
          onClick={forgetNotices}
          class="text-faint transition-colors hover:text-text"
        >
          <Icon name="stop" size={12} />
        </button>
      }
    >
      {!permitted.value && (
        <button
          type="button"
          onClick={() => void askForPermission()}
          class="flex items-center gap-1.5 rounded-sm px-1 py-1 text-left text-xs text-state-blocked transition-colors hover:bg-raised"
        >
          <Icon name="bellOff" size={12} class="shrink-0" />
          {t("notify.denied")}
        </button>
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
      lead={
        session ? (
          <AgentIcon agent={session.agent} class="text-faint" />
        ) : (
          <Icon name={glyph(notice)} size={12} class="text-faint" />
        )
      }
      trail={<span class="tabular-nums">{ago}</span>}
      onClick={() => {
        if (session && !focusSession(session.id)) {
          openInNewTab(session);
        }
      }}
    />
  );
}

function glyph(notice: Notice) {
  return notice.kind === "quota" ? "activity" : "bell";
}
