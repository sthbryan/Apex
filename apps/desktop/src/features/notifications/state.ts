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
import { agents, complain, notices as toasts } from "@/shared/daemon";
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
const TOAST_MS = 6000;

export const notices = signal<Notice[]>([]);
export const live = signal<number[]>([]);
export const unread = computed(() => notices.value.filter((notice) => !notice.read).length);

export const waiting = computed(() =>
  sessions.value.filter((session) => session.state === "blocked"),
);

const announced = new Map<string, SessionState>();
const lastSent = new Map<string, number>();
const lastQuota = new Map<string, number>();
export const permitted = signal(false);

let focused = true;
let nextNotice = 0;
let lastComplaint = 0;

export function push(entry: Omit<Notice, "id" | "at" | "read">): void {
  const notice: Notice = { ...entry, id: ++nextNotice, at: Date.now(), read: false };
  notices.value = [...notices.value, notice].slice(-KEPT);
  if (shouldToast(notice)) {
    live.value = [...live.value, notice.id];
    if (notice.kind !== "error") {
      setTimeout(() => dismissToast(notice.id), TOAST_MS);
    }
  }
  if (shouldDisturb(notice)) {
    sendNotification({ title: notice.title, body: notice.body });
  }
}

export function warnBlockedAgents(): void {
  for (const agent of agents.value.filter((found) => found.mcp_blocked)) {
    push({
      sessionId: null,
      kind: "error",
      title: t("notify.mcpBlocked", { agent: agent.name }),
      body: agent.mcp_hint ?? "",
    });
  }
}

export function dismissToast(id: number): void {
  live.value = live.value.filter((candidate) => candidate !== id);
}

export function dismissToasts(): void {
  live.value = [];
}

export function lasting(kind: NoticeKind): boolean {
  return kind === "error";
}

function shouldToast(notice: Notice): boolean {
  if (notice.kind === "quiet") {
    return false;
  }
  if (notice.sessionId === null) {
    return true;
  }
  if (mutedSessions.peek().includes(notice.sessionId)) {
    return false;
  }
  return !(focused && visibleSessions.peek().has(notice.sessionId));
}

export function markAllRead(): void {
  notices.value = notices.value.map((notice) => ({ ...notice, read: true }));
}

export function forgetNotices(): void {
  notices.value = [];
}

function shouldDisturb(notice: Notice): boolean {
  if (notice.kind === "quiet") {
    return false;
  }
  if (!permitted.peek() || !notifyEnabled.peek()) {
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

function headline(kind: NotifyKind, sessionId: string | null): string {
  if (kind !== "exited") {
    return t("notify.terminal");
  }
  const session = sessions.value.find((candidate) => candidate.id === sessionId);
  return session?.task ? t("notify.taskExited") : t("notify.exited");
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
  permitted.value = await ensurePermission();
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
      title: event.title ?? headline(event.notice, event.session),
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

export async function askForPermission(): Promise<void> {
  permitted.value = await ensurePermission();
}

async function ensurePermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) {
      return true;
    }
    return (await requestPermission()) === "granted";
  } catch (cause) {
    complain(cause);
    return false;
  }
}
