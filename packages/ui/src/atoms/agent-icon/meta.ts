import type { ComponentMeta } from "@/lib/meta";
import { AGENT_GLYPHS } from "@/atoms/agent-icon/glyphs";

export const agentIconMeta: ComponentMeta = {
  name: "AgentIcon",
  layer: "atom",
  description: "Brand mark for each agent, with an initials fallback for unknown ids.",
  variants: [
    ...Object.keys(AGENT_GLYPHS).map((agent) => ({ name: agent, props: { agent } })),
    { name: "unknown", props: { agent: "zed" } },
    { name: "xs", props: { agent: "claude", size: "xs" } },
    { name: "lg", props: { agent: "claude", size: "lg" } },
  ],
};
