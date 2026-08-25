import { invoke } from "@tauri-apps/api/core";

import { projectSessions } from "@/features/projects/state";
import { browsing } from "@/features/settings/browsing";
import { openBrowser } from "@/features/workspace/state";
import { complain } from "@/shared/daemon";

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
