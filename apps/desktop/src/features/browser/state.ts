import { effect, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import { asideOpen, asidePanel, closeAside, openAside } from "@/app/layout/state";
import { projectSessions } from "@/features/projects/state";
import { browsing } from "@/features/settings/browsing";
import { groupOn } from "@/features/settings/toolGroups";
import { complain } from "@/shared/daemon";

const LOCAL = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
const LAST_URL = "apex.browser.url";
const FALLBACK = "http://localhost:3000";

export const browserUrl = signal<string | null>(null);

export function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return LOCAL.includes(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function showBrowser(url: string): void {
  try {
    localStorage.setItem(LAST_URL, url);
  } catch {}
  browserUrl.value = url;
  openAside("browser");
}

export function openWeb(url: string): void {
  if (isLocal(url) && browsing.value === "internal") {
    showBrowser(url);
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

export function showingBrowser(): boolean {
  return asideOpen.value && asidePanel.value === "browser";
}

export function toggleBrowser(): void {
  if (showingBrowser()) {
    closeAside();
    return;
  }
  if (browserUrl.value) {
    openAside("browser");
    return;
  }
  const running = projectSessions.value.map((session) => session.url);
  showBrowser(pickUrl(running, readLast()));
}

function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_URL);
  } catch {
    return null;
  }
}

export function startBrowserGuard(): () => void {
  return effect(() => {
    if (!groupOn("browser") && showingBrowser()) {
      closeAside();
    }
  });
}

export type Word =
  | { kind: "loaded"; url: string; title: string | null }
  | {
      kind: "logs";
      logs: { level: string; text: string; at: number; seq: number }[];
      failures: number;
    }
  | { kind: "leaving"; url: string }
  | { kind: "page"; request: string; page: unknown };

const KINDS = ["loaded", "logs", "leaving", "page"];

export function readWord(data: unknown): Word | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const said = data as { apex?: unknown; kind?: unknown };
  if (said.apex !== true || typeof said.kind !== "string" || !KINDS.includes(said.kind)) {
    return null;
  }
  return said as unknown as Word;
}

export function startBlockedUrls(): () => void {
  const refused = (event: SecurityPolicyViolationEvent) => {
    if (event.violatedDirective !== "frame-src" || !event.blockedURI) {
      return;
    }
    void invoke("open_url", { url: event.blockedURI }).catch(complain);
  };
  document.addEventListener("securitypolicyviolation", refused);
  return () => {
    document.removeEventListener("securitypolicyviolation", refused);
  };
}
