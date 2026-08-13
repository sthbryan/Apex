import type { AgentSummary } from "../bindings/AgentSummary";
import { t } from "../i18n";

type Props = {
  agents: AgentSummary[];
  loading: boolean;
};

export function AgentList({ agents, loading }: Props) {
  if (loading) {
    return <p class="text-faint">{t("agents.detecting")}</p>;
  }

  const available = agents.filter((agent) => agent.resolved_path !== null);
  const missing = agents.filter((agent) => agent.resolved_path === null);

  return (
    <div class="flex flex-col gap-6">
      <Section title={t("agents.available")} agents={available} />
      {missing.length > 0 && <Section title={t("agents.missing")} agents={missing} />}
    </div>
  );
}

function Section({ title, agents }: { title: string; agents: AgentSummary[] }) {
  return (
    <section>
      <h2 class="mb-2 uppercase tracking-wider text-faint">
        {title} · {agents.length}
      </h2>
      <ul class="flex flex-col gap-px overflow-hidden rounded border border-border">
        {agents.map((agent) => (
          <li key={agent.name} class="flex items-center gap-3 bg-surface px-3 py-2">
            <StatusDot available={agent.resolved_path !== null} />
            <span class="w-24 shrink-0">{agent.name}</span>
            <span class="shrink-0 rounded border border-border px-1.5 uppercase text-faint">
              {agent.mode}
            </span>
            {agent.supports_resume && (
              <span class="shrink-0 text-faint">{t("agents.supportsResume")}</span>
            )}
            <span class="truncate text-muted" title={agent.resolved_path ?? undefined}>
              {agent.resolved_path ?? t("agents.notFound", { command: agent.command })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusDot({ available }: { available: boolean }) {
  return (
    <span
      class={`size-2 shrink-0 rounded-full ${
        available ? "bg-state-done" : "border border-state-idle"
      }`}
      aria-label={t(available ? "agents.dot.available" : "agents.dot.missing")}
    />
  );
}
