import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import type { HistoryEntry } from "@/bindings/HistoryEntry";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { sessions } from "@/features/sessions/state";
import {
  clearWorkspace,
  focusSession,
  openInNewTab,
  restoreLayout,
  serializeLayout,
  tabs,
} from "@/features/workspace/state";

const STORAGE_KEY = "apex.project";

export const projects = signal<ProjectSummary[]>([]);
export const history = signal<HistoryEntry[]>([]);
export const activeProjectId = signal<string | null>(null);

export const activeProject = computed(
  () => projects.value.find((project) => project.id === activeProjectId.value) ?? null,
);

export const projectSessions = computed(() =>
  sessions.value.filter((session) => session.project_id === activeProjectId.value),
);

export const foreignSessions = computed(() =>
  sessions.value.filter(
    (session) => session.project_id !== activeProjectId.value && session.exit_code === null,
  ),
);

export async function revealSession(session: SessionSummary): Promise<void> {
  await switchTo(session.project_id);
  if (!focusSession(session.id)) {
    openInNewTab(session);
  }
}

export async function loadProjects(): Promise<void> {
  projects.value = await invoke<ProjectSummary[]>("list_projects");

  const remembered = readStored();
  const initial =
    projects.value.find((project) => project.id === remembered) ?? projects.value[0] ?? null;
  if (initial) {
    await activate(initial.id);
  }
}

export async function pickProject(): Promise<void> {
  const picked = await open({ directory: true, multiple: false });
  if (typeof picked !== "string") {
    return;
  }
  const project = await invoke<ProjectSummary>("open_project", { root: picked });
  projects.value = [project, ...projects.value.filter((known) => known.id !== project.id)];
  await switchTo(project.id);
}

export async function removeProject(id: string): Promise<void> {
  await invoke("remove_project", { project: id });
  projects.value = projects.value.filter((project) => project.id !== id);

  if (id !== activeProjectId.value) {
    return;
  }
  const next = projects.value[0] ?? null;
  if (next) {
    await activate(next.id);
    return;
  }
  clearWorkspace();
  activeProjectId.value = null;
  history.value = [];
  clearStored();
}

export async function switchTo(id: string): Promise<void> {
  if (id === activeProjectId.value) {
    return;
  }
  await persistLayout();
  await activate(id);
}

export async function persistLayout(): Promise<void> {
  const current = activeProjectId.value;
  if (!current) {
    return;
  }
  await invoke("save_layout", { project: current, payload: serializeLayout() });
}

async function activate(id: string): Promise<void> {
  clearWorkspace();
  activeProjectId.value = id;
  writeStored(id);

  const payload = await invoke<string | null>("load_layout", { project: id });
  const live = new Set(sessions.value.map((session) => session.id));
  restoreLayout(payload, live);

  history.value = await invoke<HistoryEntry[]>("list_history", { project: id }).catch(() => []);
}

export function scheduleLayoutSave(): void {
  if (pending !== null) {
    clearTimeout(pending);
  }
  pending = setTimeout(() => {
    pending = null;
    void persistLayout();
  }, 400);
}

let pending: ReturnType<typeof setTimeout> | null = null;

export function startLayoutSaves(): () => void {
  return tabs.subscribe(() => {
    if (activeProjectId.value) {
      scheduleLayoutSave();
    }
  });
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearStored(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function writeStored(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}
