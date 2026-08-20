import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "preact/hooks";

import { browsing } from "@/features/settings/browsing";
import { openBrowser } from "@/features/workspace/state";
import { complain } from "@/shared/daemon";

export const overlays = signal(0);

const LOCAL = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

export function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return LOCAL.includes(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function openWeb(url: string): void {
  if (isLocal(url) && browsing.value === "internal") {
    openBrowser(url);
    return;
  }
  void invoke("open_url", { url }).catch(complain);
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
