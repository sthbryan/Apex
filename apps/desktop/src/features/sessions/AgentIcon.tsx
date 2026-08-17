import { Icon, type IconName } from "@/shared/ui/Icon";

const AGENT_ICONS: Record<string, IconName> = {
  claude: "sparkles",
  opencode: "braces",
  codex: "cpu",
  gemini: "gem",
  copilot: "rocket",
  grok: "brain",
  pi: "atom",
  shell: "sessions",
};

type Props = {
  agent: string;
  size?: number;
  class?: string;
};

export function AgentIcon({ agent, size = 14, class: className }: Props) {
  return <Icon name={AGENT_ICONS[agent] ?? "bot"} size={size} class={className} />;
}
