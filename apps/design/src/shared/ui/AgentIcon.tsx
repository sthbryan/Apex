import claude from "@/shared/ui/agent-icons/claude.svg?raw";
import codex from "@/shared/ui/agent-icons/codex.svg?raw";
import githubcopilot from "@/shared/ui/agent-icons/githubcopilot.svg?raw";
import gemini from "@/shared/ui/agent-icons/grok.svg?raw";
import grok from "@/shared/ui/agent-icons/grok.svg?raw";
import opencode from "@/shared/ui/agent-icons/opencode.svg?raw";
import pi from "@/shared/ui/agent-icons/pi.svg?raw";

/* Real brand marks, same assets as apps/desktop. gemini falls back to
   grok's mark until we add the real one to the shared set. */
const BRANDS: Record<string, string> = {
  claude, codex, copilot: githubcopilot, gemini, grok, opencode, pi,
};

const FALLBACK: Record<string, string> = {
  gemini: gemini,
};

export function AgentIcon({ agent, size = 14 }: { agent: string; size?: number }) {
  const svg = BRANDS[agent] ?? FALLBACK[agent];
  return (
    <span
      class="agent-glyph brand"
      style={`width:${size}px;height:${size}px;font-size:${Math.max(7, size * 0.55)}px`}
      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
    />
  );
}
