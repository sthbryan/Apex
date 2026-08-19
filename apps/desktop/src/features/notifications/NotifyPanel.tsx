import cn from "cnfast";
import type { Notice } from "@/features/notifications/state";
import { forgetNotices, notices } from "@/features/notifications/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { sessions } from "@/features/sessions/state";
import { roughly } from "@/features/usage/format";
import { focusSession, openInNewTab } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  onClose: () => void;
};

export function NotifyPanel({ onClose }: Props) {
  const latest = [...notices.value].reverse();

  return (
    <div class="flex max-h-96 flex-col">
      <header class="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
        <Icon name="bell" size={12} class="text-faint" />
        <span class="truncate text-[12px] font-medium text-text">{t("notify.title")}</span>
        <button
          type="button"
          title={t("notify.clear")}
          onClick={forgetNotices}
          class="ml-auto text-faint transition-colors hover:text-text"
        >
          <Icon name="stop" size={12} />
        </button>
        <button
          type="button"
          onClick={onClose}
          class="text-faint transition-colors hover:text-text"
        >
          <Icon name="close" size={12} />
        </button>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto py-1">
        {latest.length === 0 ? (
          <p class="px-2.5 py-2 text-faint">{t("notify.empty")}</p>
        ) : (
          latest.map((notice) => <NoticeRow key={notice.id} notice={notice} />)
        )}
      </div>
    </div>
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
        "flex w-full items-start gap-2 px-2.5 py-1 text-left transition-colors",
        session ? "hover:bg-raised" : "cursor-default",
        notice.read ? "text-muted" : "text-text",
      )}
    >
      {session ? (
        <AgentIcon agent={session.agent} size={12} class="mt-0.5 shrink-0 text-faint" />
      ) : (
        <Icon name={glyph(notice)} size={12} class="mt-0.5 shrink-0 text-faint" />
      )}
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[12px]">{notice.title}</span>
        {notice.body && <span class="block truncate text-micro text-faint">{notice.body}</span>}
      </span>
      <span class="shrink-0 text-micro text-faint tabular-nums">{ago}</span>
    </button>
  );
}

function glyph(notice: Notice) {
  return notice.kind === "quota" ? "activity" : "bell";
}
