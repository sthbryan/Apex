import { signal } from "@preact/signals";

import type { AgentMode } from "@/bindings/AgentMode";

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
