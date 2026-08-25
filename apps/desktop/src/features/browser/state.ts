import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "preact/hooks";

import { projectSessions } from "@/features/projects/state";
import { browsing } from "@/features/settings/browsing";
import { openBrowser } from "@/features/workspace/state";
import { complain } from "@/shared/daemon";

export const overlays = signal(0);

const LOCAL = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
const LAST_URL = "apex.browser.url";
const FALLBACK = "http://localhost:3000";

export function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return LOCAL.includes(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function openWeb(url: string, name?: string): void {
  if (isLocal(url) && browsing.value === "internal") {
    localStorage.setItem(LAST_URL, url);
    openBrowser(url, name);
    return;
  }
  void invoke("open_url", { url }).catch(complain);
}

export function pickUrl(running: (string | null)[], last: string | null): string {
  const live = running.find((url) => url !== null && isLocal(url));
  if (live) {
    return live;
  }
  return last && isLocal(last) ? last : FALLBACK;
}

export function openBrowserPane(): void {
  const running = projectSessions.value.map((session) => session.url);
  openWeb(pickUrl(running, localStorage.getItem(LAST_URL)));
}

export function startBlockedUrls(): () => void {
  const stop = listen<string>("browser-blocked", (event) => {
    void invoke("open_url", { url: event.payload }).catch(complain);
  });
  return () => {
    void stop.then((off) => off());
  };
}

export function useOverlay(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    overlays.value += 1;
    return () => {
      overlays.value -= 1;
    };
  }, [active]);
}
