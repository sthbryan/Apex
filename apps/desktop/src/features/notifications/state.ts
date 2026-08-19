import { computed, effect, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import type { NotifyKind } from "@/bindings/NotifyKind";
import type { SessionState } from "@/bindings/SessionState";
import { projects } from "@/features/projects/state";
import { onNotice, sessions } from "@/features/sessions/state";
import { mutedSessions, notifyEnabled } from "@/features/settings/agentMode";
import { visibleSessions } from "@/features/workspace/state";
import { notices as toasts } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { metrics } from "@/shared/telemetry";

export type NoticeKind = NotifyKind | "blocked" | "done" | "quota" | "error";

export type Notice = {
  id: number;
  sessionId: string | null;
  kind: NoticeKind;
  title: string;
  body: string;
  at: number;
  read: boolean;
};

const KEPT = 50;
const COOLDOWN_MS = 4000;

export const notices = signal<Notice[]>([]);
export const unread = computed(() => notices.value.filter((notice) => !notice.read).length);

export const waiting = computed(() =>
  sessions.value.filter((session) => session.state === "blocked"),
);

const announced = new Map<string, SessionState>();
const lastSent = new Map<string, number>();
const lastQuota = new Map<string, number>();
let allowed = false;
let focused = true;
let nextNotice = 0;
let lastComplaint = 0;

export function push(entry: Omit<Notice, "id" | "at" | "read">): void {
  const notice: Notice = { ...entry, id: ++nextNotice, at: Date.now(), read: false };
  notices.value = [...notices.value, notice].slice(-KEPT);
  if (shouldDisturb(notice)) {
    sendNotification({ title: notice.title, body: notice.body });
  }
}

export function markAllRead(): void {
  notices.value = notices.value.map((notice) => ({ ...notice, read: true }));
}

export function forgetNotices(): void {
  notices.value = [];
}

function shouldDisturb(notice: Notice): boolean {
  if (!allowed || !notifyEnabled.peek()) {
    return false;
  }
  if (notice.sessionId === null) {
    return true;
  }
  if (mutedSessions.peek().includes(notice.sessionId)) {
    return false;
  }
  if (focused && visibleSessions.peek().has(notice.sessionId)) {
    return false;
  }
  return !sentRecently(notice.sessionId);
}

function sentRecently(sessionId: string): boolean {
  const now = Date.now();
  const previous = lastSent.get(sessionId) ?? 0;
  if (now - previous < COOLDOWN_MS) {
    return true;
  }
  lastSent.set(sessionId, now);
  return false;
}

function headline(kind: NotifyKind): string {
  return kind === "exited" ? t("notify.exited") : t("notify.terminal");
}

export function scopeOf(sessionId: string | null): string {
  const session = sessions.value.find((candidate) => candidate.id === sessionId);
  if (!session) {
    return t("app.name");
  }
  const project = projects.value.find((candidate) => candidate.id === session.project_id)?.name;
  return project ? `${project} · ${session.title}` : session.title;
}

export async function startNotifications(): Promise<() => void> {
  allowed = await ensurePermission();
  for (const session of sessions.value) {
    announced.set(session.id, session.state);
  }

  const window = getCurrentWindow();
  focused = await window.isFocused();
  const unlisten = await window.onFocusChanged(({ payload }) => {
    focused = payload;
  });

  const stopWatching = effect(() => {
    for (const session of sessions.value) {
      const previous = announced.get(session.id);
      announced.set(session.id, session.state);
      if (previous === session.state) {
        continue;
      }
      if (session.state === "blocked" || session.state === "done") {
        push({
          sessionId: session.id,
          kind: session.state,
          title: session.state === "blocked" ? t("notify.blocked") : t("notify.done"),
          body: scopeOf(session.id),
        });
      }
    }
    void invoke("set_badge", { count: waiting.value.length }).catch(() => {});
  });

  const stopListening = onNotice((event) => {
    push({
      sessionId: event.session,
      kind: event.notice,
      title: event.title ?? headline(event.notice),
      body: event.body.length > 0 ? event.body : scopeOf(event.session),
    });
  });

  const stopComplaints = effect(() => {
    for (const toast of toasts.value) {
      if (toast.id <= lastComplaint) {
        continue;
      }
      lastComplaint = toast.id;
      push({ sessionId: null, kind: "error", title: t("notify.error"), body: toast.text });
    }
  });

  const stopQuota = effect(() => {
    for (const report of metrics.value?.quotas ?? []) {
      const tight = Math.max(0, ...report.windows.map((window) => window.used_percent));
      const overPace = report.windows.some((window) => window.lasts_to_reset === false);
      if (tight < 100 && !overPace) {
        lastQuota.delete(report.agent);
        continue;
      }
      if (lastQuota.get(report.agent) === tight) {
        continue;
      }
      lastQuota.set(report.agent, tight);
      push({
        sessionId: null,
        kind: "quota",
        title: t("notify.quota", { agent: report.agent }),
        body: `${tight}%`,
      });
    }
  });

  return () => {
    unlisten();
    stopWatching();
    stopListening();
    stopComplaints();
    stopQuota();
  };
}

async function ensurePermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) {
      return true;
    }
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}
