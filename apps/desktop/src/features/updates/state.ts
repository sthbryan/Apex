import { signal } from "@preact/signals";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export type UpdateStage =
  | "idle"
  | "checking"
  | "current"
  | "found"
  | "downloading"
  | "ready"
  | "failed";

export type Offer = { version: string; notes: string | null };

export const stage = signal<UpdateStage>("idle");
export const offered = signal<Offer | null>(null);
export const progress = signal(0);
export const failure = signal<string | null>(null);

const AUTO_KEY = "apex.autoUpdate";

function restoreAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "off";
  } catch {
    return true;
  }
}

export const autoUpdate = signal(restoreAuto());

export function setAutoUpdate(next: boolean): void {
  autoUpdate.value = next;
  localStorage.setItem(AUTO_KEY, next ? "on" : "off");
}

let pending: Update | null = null;

function settled(): boolean {
  return stage.value === "downloading" || stage.value === "ready";
}

export async function lookForUpdate(): Promise<boolean> {
  if (settled()) {
    return offered.value !== null;
  }
  stage.value = "checking";
  failure.value = null;
  try {
    const found = await check();
    if (!found) {
      pending = null;
      offered.value = null;
      stage.value = "current";
      return false;
    }
    pending = found;
    offered.value = { version: found.version, notes: found.body ?? null };
    stage.value = "found";
    return true;
  } catch (error) {
    pending = null;
    offered.value = null;
    failure.value = String(error);
    stage.value = "failed";
    return false;
  }
}

export async function fetchUpdate(): Promise<void> {
  if (!pending || settled()) {
    return;
  }
  stage.value = "downloading";
  progress.value = 0;
  let total = 0;
  let taken = 0;
  try {
    await pending.download((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? 0;
      } else if (event.event === "Progress") {
        taken += event.data.chunkLength;
        progress.value = total > 0 ? Math.min(taken / total, 1) : 0;
      } else {
        progress.value = 1;
      }
    });
    stage.value = "ready";
  } catch (error) {
    failure.value = String(error);
    stage.value = "failed";
  }
}

export async function applyUpdate(): Promise<void> {
  if (!pending || stage.value !== "ready") {
    return;
  }
  try {
    await pending.install();
    await relaunch();
  } catch (error) {
    failure.value = String(error);
    stage.value = "failed";
  }
}

export function forgetUpdate(): void {
  pending = null;
  offered.value = null;
  progress.value = 0;
  failure.value = null;
  stage.value = "idle";
}

export async function watchForUpdates(): Promise<void> {
  const found = await lookForUpdate();
  if (!found) {
    if (stage.value === "failed") {
      failure.value = null;
      stage.value = "idle";
    }
    return;
  }
  if (autoUpdate.value) {
    await fetchUpdate();
  }
}
