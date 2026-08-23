import cn from "cnfast";
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

const GLYPH: Record<string, IconName> = {
  error: "activity",
  quota: "activity",
  blocked: "bell",
  done: "check",
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
    <section
      aria-label={t("notify.title")}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      class={cn("fixed top-11 right-4 z-50 w-80", expanded ? "flex flex-col gap-2" : "h-16")}
      style={{ paddingRight: "var(--apex-controls-end, 0px)" }}
    >
      {shown.map((notice, depth) => (
        <Toast key={notice.id} notice={notice} depth={depth} expanded={expanded} />
      ))}
    </section>
  );
}

function Toast({ notice, depth, expanded }: { notice: Notice; depth: number; expanded: boolean }) {
  const [drag, setDrag] = useState(0);
  const session = sessions.value.find((candidate) => candidate.id === notice.sessionId);

  const stacked = !expanded
    ? {
        position: "absolute" as const,
        top: 0,
        right: 0,
        left: 0,
        zIndex: STACKED - depth,
        transform: `translateY(${depth * 8}px) scale(${1 - depth * 0.05})`,
        opacity: depth === 0 ? 1 : 0.7,
      }
    : {};

  return (
    <output
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
      class={cn(
        "relative flex touch-none animate-drop-in items-start gap-2.5 overflow-hidden rounded-lg border bg-float px-3 py-2 shadow-2xl transition-[transform,opacity] duration-(--apex-quick)",
        notice.kind === "error" ? "border-state-failed" : "border-border",
      )}
      style={{
        ...stacked,
        ...(drag > 0
          ? { transform: `translateX(${drag}px)`, opacity: 1 - drag / (SWIPE * 2) }
          : {}),
      }}
    >
      {session ? (
        <AgentIcon agent={session.agent} class="mt-0.5 shrink-0 text-faint" />
      ) : (
        <Icon name={GLYPH[notice.kind] ?? "bell"} size={13} class="mt-0.5 shrink-0 text-faint" />
      )}

      <button
        type="button"
        disabled={!session}
        onClick={() => {
          if (session && !focusSession(session.id)) {
            openInNewTab(session);
          }
          dismissToast(notice.id);
        }}
        class={cn("min-w-0 flex-1 text-left", session ? "" : "cursor-default")}
      >
        <span class="block truncate text-text">{notice.title}</span>
        {notice.body && <span class="block truncate text-micro text-faint">{notice.body}</span>}
      </button>

      <button
        type="button"
        title={t("sessions.dismiss")}
        onClick={() => dismissToast(notice.id)}
        class="mt-0.5 shrink-0 text-faint transition-colors hover:text-text"
      >
        <Icon name="close" size={12} />
      </button>

      {!lasting(notice.kind) && (
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left animate-shrink bg-accent"
        />
      )}
    </output>
  );
}
