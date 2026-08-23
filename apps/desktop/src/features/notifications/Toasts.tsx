import { Toast as KitToast, ToastStack, type ToastTone } from "@apex/ui";
import { useState } from "preact/hooks";

import type { Notice } from "@/features/notifications/state";
import { dismissToast, lasting, live, notices } from "@/features/notifications/state";
import { AgentIcon } from "@/features/sessions/AgentIcon";
import { sessions } from "@/features/sessions/state";
import { focusSession, openInNewTab } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";

const STACKED = 3;
const SWIPE = 60;
const RUNS = 6000;

const GLYPH: Record<string, IconName> = {
  error: "activity",
  quota: "activity",
  blocked: "bell",
  done: "check",
};

const TONES: Record<string, ToastTone> = {
  error: "failed",
  quota: "blocked",
  blocked: "blocked",
  done: "done",
};

export function Toasts() {
  const [expanded, setExpanded] = useState(false);
  const shown = live.value
    .map((id) => notices.value.find((notice) => notice.id === id))
    .filter((notice): notice is Notice => notice !== undefined)
    .slice(-STACKED)
    .reverse();

  if (shown.length === 0) {
    return null;
  }

  return (
    <ToastStack
      aria-label={t("notify.title")}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      class={expanded ? "top-11 bottom-auto w-80" : "top-11 bottom-auto block h-16 w-80"}
      style={{ paddingRight: "var(--apex-controls-end, 0px)" }}
    >
      {shown.map((notice, depth) => (
        <Toast key={notice.id} notice={notice} depth={depth} expanded={expanded} />
      ))}
    </ToastStack>
  );
}

function Toast({ notice, depth, expanded }: { notice: Notice; depth: number; expanded: boolean }) {
  const [drag, setDrag] = useState(0);
  const session = sessions.value.find((candidate) => candidate.id === notice.sessionId);

  const stacked = expanded
    ? {}
    : {
        position: "absolute" as const,
        top: 0,
        right: 0,
        left: 0,
        zIndex: STACKED - depth,
        transform: `translateY(${depth * 8}px) scale(${1 - depth * 0.05})`,
        opacity: depth === 0 ? 1 : 0.7,
      };

  const open = () => {
    if (session && !focusSession(session.id)) {
      openInNewTab(session);
    }
    dismissToast(notice.id);
  };

  return (
    <KitToast
      class={
        notice.kind === "error" ? "w-full touch-none border-state-failed" : "w-full touch-none"
      }
      tone={TONES[notice.kind] ?? "accent"}
      duration={lasting(notice.kind) ? undefined : RUNS}
      title={notice.title}
      detail={notice.body ?? undefined}
      role={session ? "button" : undefined}
      tabIndex={session ? 0 : undefined}
      onClick={session ? open : undefined}
      onKeyDown={
        session
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
              }
            }
          : undefined
      }
      onPointerMove={(event) => {
        if (event.buttons !== 1) {
          return;
        }
        const next = Math.max(0, event.movementX + drag);
        if (next > 0 && !event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        setDrag(next);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (drag > SWIPE) {
          dismissToast(notice.id);
        }
        setDrag(0);
      }}
      style={{
        ...stacked,
        ...(drag > 0
          ? { transform: `translateX(${drag}px)`, opacity: 1 - drag / (SWIPE * 2) }
          : {}),
      }}
      lead={
        session ? (
          <AgentIcon agent={session.agent} class="text-faint" />
        ) : (
          <Icon name={GLYPH[notice.kind] ?? "bell"} size={13} class="shrink-0 text-faint" />
        )
      }
      actions={
        <button
          type="button"
          title={t("sessions.dismiss")}
          onClick={(event) => {
            event.stopPropagation();
            dismissToast(notice.id);
          }}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="close" size={12} />
        </button>
      }
    />
  );
}
