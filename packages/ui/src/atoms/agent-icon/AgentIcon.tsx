import { cn } from "@/lib/cn";
import { AGENT_GLYPHS } from "@/atoms/agent-icon/glyphs";
import type { AgentIconGlyph, AgentId } from "@/atoms/agent-icon/glyphs";

export type AgentIconSize = "xs" | "sm" | "md" | "lg";

export interface AgentIconProps {
  agent: AgentId | (string & {});
  size?: AgentIconSize;
  label?: string;
  class?: string;
}

export function AgentIcon({ agent, size = "md", label, class: className }: AgentIconProps) {
  const glyph: AgentIconGlyph | undefined = AGENT_GLYPHS[agent as AgentId];
  const name = label ?? glyph?.label ?? agent;
  return (
    <span
      class={cn("ui-agent-icon", !glyph && "ui-agent-icon-fallback", className)}
      data-size={size}
      data-agent={agent}
      role="img"
      aria-label={name}
      title={name}
    >
      {glyph ? (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {glyph.paths.map((path) => (
            <path key={path.d} d={path.d} fillRule={path.fillRule} clipRule={path.clipRule} />
          ))}
        </svg>
      ) : (
        agent.slice(0, 2)
      )}
    </span>
  );
}
