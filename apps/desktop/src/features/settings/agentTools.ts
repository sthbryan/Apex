import { invoke } from "@tauri-apps/api/core";
import type { AgentSummary } from "@/bindings/AgentSummary";
import type { ToolGroup } from "@/bindings/ToolGroup";
import { agents } from "@/shared/daemon";

export const OPTIONAL_GROUPS = ["observation", "orchestration", "views", "browser"] as const;

export type OptionalGroup = (typeof OPTIONAL_GROUPS)[number];

export function toolsOff(agent: string): ToolGroup[] {
  return agents.value.find((found) => found.name === agent)?.tools_off ?? [];
}

export function groupOn(agent: string, group: OptionalGroup): boolean {
  return !toolsOff(agent).includes(group);
}

export async function setGroupOn(agent: string, group: OptionalGroup, on: boolean): Promise<void> {
  const rest = toolsOff(agent).filter((found) => found !== group);
  const next = on ? rest : [...rest, group];
  await invoke("set_agent_tools", { agent, toolsOff: next });
  agents.value = agents.value.map((found) =>
    found.name === agent ? ({ ...found, tools_off: next } as AgentSummary) : found,
  );
}
