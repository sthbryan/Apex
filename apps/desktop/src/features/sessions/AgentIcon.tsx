import cn from "cnfast";
import antigravity from "@/features/sessions/agent-icons/antigravity.svg?raw";
import claude from "@/features/sessions/agent-icons/claude.svg?raw";
import codex from "@/features/sessions/agent-icons/codex.svg?raw";
import githubcopilot from "@/features/sessions/agent-icons/githubcopilot.svg?raw";
import grok from "@/features/sessions/agent-icons/grok.svg?raw";
import opencode from "@/features/sessions/agent-icons/opencode.svg?raw";
import pi from "@/features/sessions/agent-icons/pi.svg?raw";
import { Icon, type IconName } from "@/shared/ui/Icon";

const BRAND_SVGS: Record<string, string> = {
  antigravity,
  claude,
  codex,
  copilot: githubcopilot,
  grok,
  opencode,
  pi,
};

const FALLBACK_ICONS: Record<string, IconName> = {
  shell: "sessions",
};

type Props = {
  agent: string;
  size?: number;
  class?: string;
};

export function AgentIcon({ agent, size = 14, class: className }: Props) {
  const svg = BRAND_SVGS[agent];
  if (!svg) {
    return <Icon name={FALLBACK_ICONS[agent] ?? "bot"} size={size} class={className} />;
  }
  return (
    <span
      class={cn("inline-flex shrink-0", className)}
      style={{ fontSize: size, lineHeight: 1 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
