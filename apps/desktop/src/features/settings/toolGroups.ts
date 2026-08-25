import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import type { ToolGroup } from "@/bindings/ToolGroup";

export const OPTIONAL_GROUPS = ["observation", "orchestration", "views", "browser", "api"] as const;

export type OptionalGroup = (typeof OPTIONAL_GROUPS)[number];

export const toolsOff = signal<ToolGroup[]>([]);

export async function loadToolGroups(): Promise<void> {
  toolsOff.value = await invoke<ToolGroup[]>("list_tool_groups");
}

export function groupOn(group: OptionalGroup): boolean {
  return !toolsOff.value.includes(group);
}

export async function setGroupOn(group: OptionalGroup, on: boolean): Promise<void> {
  const rest = toolsOff.value.filter((found) => found !== group);
  const next = on ? rest : [...rest, group];
  await invoke("set_tool_groups", { toolsOff: next });
  toolsOff.value = next;
}
