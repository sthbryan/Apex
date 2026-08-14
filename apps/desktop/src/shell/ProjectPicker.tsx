import { useEffect, useRef, useState } from "preact/hooks";

import { Icon } from "../components/Icon";
import { t } from "../i18n";
import { activeProject, pickProject, projects, switchTo } from "../projects";
import { sessions } from "../sessions";

export function ProjectPicker() {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", dismiss);
    return () => window.removeEventListener("mousedown", dismiss);
  }, [open]);

  const current = activeProject.value;

  return (
    <div ref={holder} class="relative">
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        title={current?.root ?? t("projects.none")}
        class="flex max-w-56 items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-raised"
      >
        <span class="truncate">{current?.name ?? t("projects.none")}</span>
        {waitingElsewhere() > 0 && <span class="size-1.5 rounded-full bg-state-blocked" />}
        <Icon name="chevron" size={12} class="text-faint" />
      </button>

      {open && (
        <div class="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
          <ul class="max-h-72 overflow-y-auto py-1">
            {projects.value.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void switchTo(project.id);
                  }}
                  class={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-raised ${
                    project.id === current?.id ? "text-text" : "text-muted"
                  }`}
                >
                  <span class="truncate">{project.name}</span>
                  {project.is_git && <span class="shrink-0 text-faint">git</span>}
                  {pending(project.id) > 0 && (
                    <span class="ml-auto shrink-0 text-state-blocked">{pending(project.id)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void pickProject();
            }}
            class="w-full border-t border-border px-3 py-2 text-left text-muted hover:bg-raised hover:text-text"
          >
            {t("projects.open")}
          </button>
        </div>
      )}
    </div>
  );
}

function pending(projectId: string): number {
  return sessions.value.filter(
    (session) => session.project_id === projectId && session.state === "blocked",
  ).length;
}

function waitingElsewhere(): number {
  return sessions.value.filter(
    (session) => session.project_id !== activeProject.value?.id && session.state === "blocked",
  ).length;
}
