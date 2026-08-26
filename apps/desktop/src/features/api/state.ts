import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { ApiRequest } from "@/bindings/ApiRequest";
import type { ApiRun } from "@/bindings/ApiRun";
import { type BodyKind, bodyKind, jsonTrouble, laidOut, withBodyKind } from "@/features/api/body";
import {
  type Pair,
  readPairs,
  readParams,
  record,
  writePairs,
  writeParams,
} from "@/features/api/url";
import { activeProjectId } from "@/features/projects/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const LAST_ENV = "apex.api.environment";

export const names = signal<string[]>([]);
export const environments = signal<string[]>([]);
export const chosen = signal<string | null>(null);
export const draft = signal<ApiRequest>(blank());
export const saved = signal<ApiRequest | null>(null);
export const last = signal<ApiRun | null>(null);
export const environment = signal<string | null>(readEnvironment());
export const sending = signal(false);
export const trouble = signal<string | null>(null);

export function blank(): ApiRequest {
  return { method: "GET", url: "", headers: {}, body: null };
}

export function dirty(): boolean {
  return chosen.value !== null && JSON.stringify(draft.value) !== JSON.stringify(saved.value);
}

export async function loadCollection(): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    names.value = [];
    environments.value = [];
    return;
  }
  const found = await invoke<{ requests: string[]; environments: string[] }>("api_list", {
    project,
  });
  names.value = found.requests;
  environments.value = found.environments;
  if (environment.value && !found.environments.includes(environment.value)) {
    setEnvironment(found.environments[0] ?? null);
  }
}

export async function openRequest(name: string): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  const found = await invoke<{ request: ApiRequest; last: ApiRun | null }>("api_read", {
    project,
    name,
  });
  chosen.value = name;
  draft.value = found.request;
  saved.value = found.request;
  last.value = found.last;
  trouble.value = null;
}

export async function saveRequest(name: string): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  await invoke("api_write", { project, name, request: draft.value });
  saved.value = draft.value;
  chosen.value = name;
  await loadCollection();
}

export async function removeRequest(name: string): Promise<void> {
  const project = activeProjectId.value;
  if (!project) {
    return;
  }
  await invoke("api_remove", { project, name });
  if (chosen.value === name) {
    startNew();
  }
  await loadCollection();
}

export async function sendRequest(): Promise<void> {
  const project = activeProjectId.value;
  const name = chosen.value;
  if (!project || !name || sending.value) {
    return;
  }
  const broken = brokenJson();
  if (broken !== null) {
    trouble.value = t("api.badJson", { why: broken });
    return;
  }
  sending.value = true;
  trouble.value = null;
  try {
    if (dirty()) {
      await invoke("api_write", { project, name, request: draft.value });
      saved.value = draft.value;
    }
    last.value = await invoke<ApiRun>("api_send", {
      project,
      name,
      environment: environment.value,
    });
  } catch (cause) {
    trouble.value = String(cause);
  } finally {
    sending.value = false;
  }
}

export function brokenJson(): string | null {
  const request = draft.value;
  return bodyKind(request) === "json" ? jsonTrouble(request.body ?? "") : null;
}

export function startNew(): void {
  chosen.value = null;
  draft.value = blank();
  saved.value = null;
  last.value = null;
  trouble.value = null;
}

export function edit(change: Partial<ApiRequest>): void {
  draft.value = { ...draft.value, ...change };
}

export function params(): Pair[] {
  return readParams(draft.value.url);
}

export function setParams(pairs: Pair[]): void {
  edit({ url: writeParams(draft.value.url, pairs) });
}

export function headers(): Pair[] {
  return Object.entries(draft.value.headers).map(([key, value]) => ({ key, value }));
}

export function setHeaders(pairs: Pair[]): void {
  edit({ headers: record(pairs) });
}

export function fields(): Pair[] {
  return readPairs(draft.value.body ?? "");
}

export function setFields(pairs: Pair[]): void {
  edit({ body: writePairs(pairs) });
}

export function layOut(): void {
  const laid = laidOut(draft.value.body ?? "");
  if (laid !== null) {
    edit({ body: laid });
  }
}

export function setKind(kind: BodyKind): void {
  draft.value = withBodyKind(draft.value, kind);
}

export function setEnvironment(name: string | null): void {
  environment.value = name;
  try {
    if (name) {
      localStorage.setItem(LAST_ENV, name);
    } else {
      localStorage.removeItem(LAST_ENV);
    }
  } catch {}
}

export function startCollection(): () => void {
  void loadCollection().catch(complain);
  return () => {};
}

function readEnvironment(): string | null {
  try {
    return localStorage.getItem(LAST_ENV);
  } catch {
    return null;
  }
}

export function tone(status: number): "ok" | "warn" | "bad" {
  if (status < 300) {
    return "ok";
  }
  return status < 400 ? "warn" : "bad";
}
