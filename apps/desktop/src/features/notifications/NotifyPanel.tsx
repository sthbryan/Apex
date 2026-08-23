import { Popover } from "@apex/ui";
import cn from "cnfast";
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
          class="flex items-center gap-1.5 rounded-sm px-1 py-1 text-left text-micro text-state-blocked transition-colors hover:bg-raised"
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
    <button
      type="button"
      disabled={!session}
      onClick={() => {
        if (session && !focusSession(session.id)) {
          openInNewTab(session);
        }
      }}
      class={cn(
        "flex w-full items-start gap-2 rounded-sm px-1 py-1 text-left transition-colors",
        session ? "hover:bg-raised" : "cursor-default",
        notice.read ? "text-muted" : "text-text",
      )}
    >
      {session ? (
        <AgentIcon agent={session.agent} class="mt-0.5 shrink-0 text-faint" />
      ) : (
        <Icon name={glyph(notice)} size={12} class="mt-0.5 shrink-0 text-faint" />
      )}
      <span class="min-w-0 flex-1">
        <span class="block truncate text-small">{notice.title}</span>
        {notice.body && <span class="block truncate text-micro text-faint">{notice.body}</span>}
      </span>
      <span class="shrink-0 text-micro text-faint tabular-nums">{ago}</span>
    </button>
  );
}

function glyph(notice: Notice) {
  return notice.kind === "quota" ? "activity" : "bell";
}
