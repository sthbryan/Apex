import type { ProjectSummary } from "../bindings/ProjectSummary";
import type { SessionSummary } from "../bindings/SessionSummary";
import { t } from "../i18n";
import { cpuHistory, memoryHistory, metrics, percentOf } from "../metrics";
import { ResourcesPanel } from "../panels/ResourcesPanel";
import { SessionsPanel } from "../panels/SessionsPanel";

export type DockPanel = "sessions" | "resources";

const PANELS: { id: DockPanel; glyph: string; label: () => string }[] = [
  { id: "sessions", glyph: "▣", label: () => t("dock.sessions") },
  { id: "resources", glyph: "◍", label: () => t("dock.resources") },
];

type Props = {
  panel: DockPanel;
  onPanel: (panel: DockPanel) => void;
  sessions: SessionSummary[];
  elsewhere: SessionSummary[];
  projects: ProjectSummary[];
};

export function Dock({ panel, onPanel, sessions, elsewhere, projects }: Props) {
  return (
    <aside class="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
      <nav class="flex shrink-0 gap-1 border-b border-border px-1 py-1">
        {PANELS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            title={entry.label()}
            onClick={() => onPanel(entry.id)}
            class={`flex size-6 items-center justify-center rounded ${
              panel === entry.id ? "bg-raised text-text" : "text-faint hover:text-text"
            }`}
          >
            {entry.glyph}
          </button>
        ))}
      </nav>

      <div class="min-h-0 flex-1">
        {panel === "sessions" ? (
          <SessionsPanel sessions={sessions} elsewhere={elsewhere} projects={projects} />
        ) : (
          <ResourcesPanel snapshot={metrics.value} />
        )}
      </div>

      <ResourceStrip onOpen={() => onPanel("resources")} />
    </aside>
  );
}

function ResourceStrip({ onOpen }: { onOpen: () => void }) {
  const snapshot = metrics.value;
  if (!snapshot) {
    return null;
  }
  const memory = percentOf(snapshot.system.memory_used, snapshot.system.memory_total);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={t("dock.resources")}
      class="flex shrink-0 items-center gap-2 border-t border-border px-2 py-1 text-faint hover:bg-raised hover:text-muted"
    >
      <Sparkline points={cpuHistory.value} />
      <span>{snapshot.system.cpu_percent.toFixed(0)}%</span>
      <Sparkline points={memoryHistory.value} />
      <span>{memory.toFixed(0)}%</span>
      {tightestQuota() !== null && (
        <span class="ml-auto text-state-blocked">{tightestQuota()}%</span>
      )}
    </button>
  );
}

function tightestQuota(): number | null {
  const windows = (metrics.value?.quotas ?? []).flatMap((report) => report.windows);
  if (windows.length === 0) {
    return null;
  }
  return Math.max(...windows.map((window) => window.used_percent));
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <span class="inline-block h-3 w-10" />;
  }
  const step = 100 / (points.length - 1);
  const path = points
    .map((value, index) => `${index === 0 ? "M" : "L"}${index * step},${100 - Math.min(100, value)}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="h-3 w-10" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" stroke-width="6" vector-effect="non-scaling-stroke" />
    </svg>
  );
}
