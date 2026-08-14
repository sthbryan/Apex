import { computed, effect } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import type { SessionState } from "./bindings/SessionState";
import { t } from "./i18n";
import { projects } from "./projects";
import { sessions } from "./sessions";

export const waiting = computed(() =>
  sessions.value.filter((session) => session.state === "blocked"),
);

const announced = new Map<string, SessionState>();
let allowed = false;
let focused = true;

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
      if (session.state === "blocked" || (session.state === "done" && !focused)) {
        announce(session.id, session.title, session.project_id, session.state);
      }
    }
    void invoke("set_badge", { count: waiting.value.length }).catch(() => {});
  });

  return () => {
    unlisten();
    stopWatching();
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

function announce(id: string, title: string, projectId: string, state: SessionState): void {
  if (!allowed || announcedRecently(id)) {
    return;
  }
  const project = projects.value.find((candidate) => candidate.id === projectId)?.name;
  const scope = project ? `${project} · ${title}` : title;

  sendNotification({
    title: state === "blocked" ? t("notify.blocked") : t("notify.done"),
    body: scope,
  });
}

const lastSent = new Map<string, number>();
const COOLDOWN_MS = 4000;

function announcedRecently(id: string): boolean {
  const now = Date.now();
  const previous = lastSent.get(id) ?? 0;
  if (now - previous < COOLDOWN_MS) {
    return true;
  }
  lastSent.set(id, now);
  return false;
}
