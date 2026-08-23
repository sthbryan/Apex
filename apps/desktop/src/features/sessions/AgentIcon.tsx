import { type AgentIconSize, AgentIcon as Brand } from "@apex/ui";
import { Icon, type IconName } from "@/shared/ui/Icon";

const ALIAS: Record<string, string> = {
  copilot: "githubcopilot",
};

const FALLBACK_ICONS: Record<string, IconName> = {
  shell: "sessions",
};

const FALLBACK_SIZES: Record<AgentIconSize, number> = {
  xs: 12,
  sm: 16,
  md: 22,
  lg: 28,
};

type Props = {
  agent: string;
  size?: AgentIconSize;
  class?: string;
};

export function AgentIcon({ agent, size = "xs", class: className }: Props) {
  const fallback = FALLBACK_ICONS[agent];
  if (fallback) {
    return <Icon name={fallback} size={FALLBACK_SIZES[size]} class={className} />;
  }
  return <Brand agent={ALIAS[agent] ?? agent} size={size} class={className} />;
}
