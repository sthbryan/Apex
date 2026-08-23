import { computed, signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import type { AgentMode } from "@/bindings/AgentMode";
import { agents, complain, installedAgents } from "@/shared/daemon";

const STORE = "apex.agent-modes";

function restore(): Record<string, AgentMode> {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Record<string, AgentMode>) : {};
  } catch {
    return {};
  }
}

export const agentModes = signal<Record<string, AgentMode>>(restore());

export function modeOf(agent: string, fallback: AgentMode): AgentMode {
  return agentModes.value[agent] ?? fallback;
}

export function setAgentMode(agent: string, mode: AgentMode): void {
  agentModes.value = { ...agentModes.value, [agent]: mode };
  localStorage.setItem(STORE, JSON.stringify(agentModes.value));
}

const OFF = "apex.agents-off";

function restoreOff(): string[] {
  try {
    const raw = localStorage.getItem(OFF);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export const disabledAgents = signal<string[]>(restoreOff());

export const enabledAgents = computed(() =>
  installedAgents.value
    .filter((agent) => !disabledAgents.value.includes(agent.name))
    .sort((left, right) => left.name.localeCompare(right.name)),
);

const LAST = "apex.last-agent";

export const lastAgent = signal<string | null>(localStorage.getItem(LAST));

export function rememberAgent(agent: string): void {
  lastAgent.value = agent;
  localStorage.setItem(LAST, agent);
}

export function agentEnabled(agent: string): boolean {
  return !disabledAgents.value.includes(agent);
}

export function setAgentEnabled(agent: string, on: boolean): void {
  const rest = disabledAgents.value.filter((name) => name !== agent);
  disabledAgents.value = on ? rest : [...rest, agent];
  localStorage.setItem(OFF, JSON.stringify(disabledAgents.value));
}

const IDLE_GRACE = "apex.idle-grace";

function restoreIdleGrace(): number {
  try {
    const raw = localStorage.getItem(IDLE_GRACE);
    return raw ? parseInt(raw, 10) : 60;
  } catch {
    return 60;
  }
}

export const idleGrace = signal<number>(restoreIdleGrace());

export function setIdleGrace(seconds: number): void {
  idleGrace.value = seconds;
  localStorage.setItem(IDLE_GRACE, String(seconds));
}

export function applyIdleGrace(): void {
  invoke("set_idle_grace", { seconds: idleGrace.value });
}

const SHARED = "apex.agent-context";

function restoreShared(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SHARED);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export const sharedContext = signal<Record<string, boolean>>(restoreShared());

export async function setSharedContext(agent: string, enabled: boolean): Promise<void> {
  await invoke("mcp_adopt", { agent, enabled });
  sharedContext.value = { ...sharedContext.value, [agent]: enabled };
  localStorage.setItem(SHARED, JSON.stringify(sharedContext.value));
}

export async function adoptAgents(): Promise<void> {
  const fresh = agents.value.filter(
    (agent) => agent.shares_config && sharedContext.value[agent.name] === undefined,
  );
  for (const agent of fresh) {
    await setSharedContext(agent.name, true).catch(complain);
  }
}

const LANDING = "apex.agent-views";

export type ViewLanding = "tab" | "split";

export const viewLanding = signal<ViewLanding>(
  (localStorage.getItem(LANDING) as ViewLanding | null) ?? "tab",
);

export function setViewLanding(landing: ViewLanding): void {
  viewLanding.value = landing;
  localStorage.setItem(LANDING, landing);
}

const CAPS = "apex.agent-view-caps";

export type SplitCaps = { yours: number; spare: number };

const DEFAULT_CAPS: SplitCaps = { yours: 5, spare: 6 };

function restoreCaps(): SplitCaps {
  try {
    const raw = localStorage.getItem(CAPS);
    return raw ? { ...DEFAULT_CAPS, ...(JSON.parse(raw) as Partial<SplitCaps>) } : DEFAULT_CAPS;
  } catch {
    return DEFAULT_CAPS;
  }
}

export const splitCaps = signal<SplitCaps>(restoreCaps());

export function setSplitCap(which: keyof SplitCaps, panes: number): void {
  splitCaps.value = { ...splitCaps.value, [which]: panes };
  localStorage.setItem(CAPS, JSON.stringify(splitCaps.value));
}

const NOTIFY = "apex.notify";

export const notifyEnabled = signal<boolean>(localStorage.getItem(NOTIFY) !== "off");

export function setNotifyEnabled(enabled: boolean): void {
  notifyEnabled.value = enabled;
  localStorage.setItem(NOTIFY, enabled ? "on" : "off");
}

const MUTED = "apex.notify-muted";

function restoreMuted(): string[] {
  try {
    const raw = localStorage.getItem(MUTED);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export const mutedSessions = signal<string[]>(restoreMuted());

export function isMuted(sessionId: string): boolean {
  return mutedSessions.value.includes(sessionId);
}

export function setMuted(sessionId: string, muted: boolean): void {
  const rest = mutedSessions.value.filter((id) => id !== sessionId);
  mutedSessions.value = muted ? [...rest, sessionId] : rest;
  localStorage.setItem(MUTED, JSON.stringify(mutedSessions.value));
}

const YOLO = "apex.race-unattended";
const YOLO_AGENTS = "apex.race-unattended-agents";

function restoreYolo(): boolean {
  try {
    return localStorage.getItem(YOLO) === "true";
  } catch {
    return false;
  }
}

function restoreYoloAgents(): string[] {
  try {
    const raw = localStorage.getItem(YOLO_AGENTS);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export const raceUnattended = signal<boolean>(restoreYolo());
export const unattendedAgents = signal<string[]>(restoreYoloAgents());

export function setRaceUnattended(on: boolean): void {
  raceUnattended.value = on;
  localStorage.setItem(YOLO, String(on));
}

export function setAgentUnattended(agent: string, on: boolean): void {
  const rest = unattendedAgents.value.filter((name) => name !== agent);
  unattendedAgents.value = on ? [...rest, agent] : rest;
  localStorage.setItem(YOLO_AGENTS, JSON.stringify(unattendedAgents.value));
}

export function runsUnattended(agent: string): boolean {
  return raceUnattended.value && unattendedAgents.value.includes(agent);
}
