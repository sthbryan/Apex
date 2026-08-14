import cn from "cnfast";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { SessionsPanel } from "@/features/sessions/SessionsPanel";
import { dockMode } from "@/features/settings/state";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";

export type DockPanel = "sessions";

const PANELS: { id: DockPanel; icon: IconName; label: () => string }[] = [
  { id: "sessions", icon: "sessions", label: () => t("dock.sessions") },
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
    <aside
      class={cn(
        "flex w-56 flex-col bg-surface",
        dockMode.value === "floating"
          ? "h-full overflow-hidden rounded-xl border border-border shadow-2xl"
          : "shrink-0 border-r border-border",
      )}
    >
      {PANELS.length > 1 && (
        <nav class="flex shrink-0 gap-1 border-b border-border px-1 py-1">
          {PANELS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={entry.label()}
              onClick={() => onPanel(entry.id)}
              class={cn(
                "flex size-6 items-center justify-center rounded transition-colors",
                panel === entry.id ? "bg-raised text-text" : "text-faint hover:text-text",
              )}
            >
              <Icon name={entry.icon} />
            </button>
          ))}
        </nav>
      )}

      <div class="min-h-0 flex-1">
        <SessionsPanel sessions={sessions} elsewhere={elsewhere} projects={projects} />
      </div>
    </aside>
  );
}
