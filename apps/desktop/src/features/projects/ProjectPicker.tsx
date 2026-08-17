import cn from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";
import { activeProject, pickProject, projects, switchTo } from "@/features/projects/state";
import { sessions } from "@/features/sessions/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  variant?: "bar" | "dock";
};

export function ProjectPicker({ variant = "bar" }: Props) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const menu = usePresence<HTMLDivElement>(open);

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
    <div ref={holder} class={cn("relative", variant === "dock" && "px-2")}>
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        title={current?.root ?? t("projects.none")}
        class={cn("flex items-center gap-1.5 rounded transition-colors", {
          "max-w-56 px-1.5 py-0.5 hover:bg-raised": variant === "bar",
          "w-full border border-border bg-raised px-2 py-1 font-medium hover:border-muted":
            variant === "dock",
        })}
      >
        <span class="truncate">{current?.name ?? t("projects.none")}</span>
        {waitingElsewhere() > 0 && (
          <span class="size-1.5 animate-breathe rounded-full bg-state-blocked" />
        )}
        <Icon
          name="chevron"
          size={12}
          class={cn("text-faint transition-transform", {
            "ml-auto": variant === "dock",
            "rotate-180": open,
          })}
        />
      </button>

      {menu.mounted && (
        <div
          ref={menu.holder}
          class={cn(
            `absolute top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-overlay shadow-2xl`,
            {
              "left-0 w-72": variant === "bar",
              "inset-x-2": variant === "dock",
              "animate-drop-out": menu.leaving,
              "animate-drop-in": !menu.leaving,
            },
          )}
        >
          <ul class="max-h-72 overflow-y-auto py-1">
            {projects.value.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void switchTo(project.id);
                  }}
                  class={cn(
                    `flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-raised`,
                    {
                      "text-text": project.id === current?.id,
                      "text-muted": project.id !== current?.id,
                    },
                  )}
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
            class="w-full border-t border-border px-3 py-2 text-left text-muted transition-colors hover:bg-raised hover:text-text"
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
