import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { MetricsSnapshot } from "./bindings/MetricsSnapshot";

const POLL_MS = 2000;

export const metrics = signal<MetricsSnapshot | null>(null);

export async function startMetrics(): Promise<() => void> {
  let focused = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const tick = async (refreshQuota: boolean) => {
    if (stopped) {
      return;
    }
    if (focused) {
      try {
        const snapshot = await invoke<MetricsSnapshot>("read_metrics", { refreshQuota });
        metrics.value = snapshot;
      } catch {
        // el daemon puede estar reiniciando; el siguiente tick reintenta
      }
    }
    timer = setTimeout(() => void tick(false), POLL_MS);
  };

  const window = getCurrentWindow();
  focused = await window.isFocused().catch(() => true);
  const unlisten = await window.onFocusChanged(({ payload }) => {
    focused = payload;
    if (payload) {
      void tick(false);
    }
  });

  void tick(true);

  return () => {
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
    }
    unlisten();
  };
}

export async function refreshQuota(): Promise<void> {
  metrics.value = await invoke<MetricsSnapshot>("read_metrics", { refreshQuota: true });
}

export async function killProcess(pid: number): Promise<void> {
  await invoke("kill_process", { pid });
}

export function percentOf(used: number, total: number): number {
  return total > 0 ? (used / total) * 100 : 0;
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
