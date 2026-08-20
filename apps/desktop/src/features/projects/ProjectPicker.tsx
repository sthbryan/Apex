import cn from "cnfast";
import { useState } from "preact/hooks";
import {
  activeProject,
  pickProject,
  projects,
  removeProject,
  switchTo,
} from "@/features/projects/state";
import { sessions } from "@/features/sessions/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { Picker, type PickerItem } from "@/shared/ui/Picker";

type Props = {
  variant?: "bar" | "dock";
};

export function ProjectPicker({ variant = "bar" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = activeProject.value;
  const dock = variant === "dock";

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const needle = query.trim().toLowerCase();
  const items: PickerItem[] = projects.value
    .filter(
      (project) =>
        !needle ||
        project.name.toLowerCase().includes(needle) ||
        project.root.toLowerCase().includes(needle),
    )
    .map((project) => {
      const live = countLive(project.id);
      const blocked = countBlocked(project.id);
      return {
        id: project.id,
        label: project.name,
        hint: prettyRoot(project.root),
        badge:
          live > 0
            ? { text: t("projects.live", { count: String(live) }), alert: blocked > 0 }
            : undefined,
        remove:
          live === 0
            ? {
                label: t("projects.remove"),
                ask: t("projects.removeAsk"),
                yes: t("projects.remove"),
                no: t("projects.removeCancel"),
                run: () => {
                  close();
                  void removeProject(project.id);
                },
              }
            : undefined,
        run: () => {
          close();
          void switchTo(project.id);
        },
      };
    });

  items.push({
    id: "open-folder",
    label: t("projects.open"),
    run: () => {
      close();
      void pickProject();
    },
  });

  return (
    <div class={cn("relative min-w-0", dock && "px-3")}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={current?.root ?? t("projects.none")}
        class={cn("flex min-w-0 items-center gap-1.5 rounded transition-colors", {
          "max-w-56 px-1.5 py-0.5 hover:bg-raised": !dock,
          "w-full text-left hover:text-text": dock,
        })}
      >
        <span class="min-w-0 flex-1">
          <span class={cn("block truncate", dock && "font-medium text-text")}>
            {current?.name ?? t("projects.none")}
          </span>
          {dock && current && (
            <span class="block truncate text-tiny text-faint">{prettyRoot(current.root)}</span>
          )}
        </span>
        {waitingElsewhere() > 0 && (
          <span class="size-1.5 shrink-0 animate-breathe rounded-full bg-state-blocked" />
        )}
        <Icon name="chevron" size={12} class="shrink-0 text-faint" />
      </button>

      <Picker
        open={open}
        onClose={close}
        query={query}
        onQuery={setQuery}
        placeholder={t("projects.search")}
        items={items}
      />
    </div>
  );
}

function prettyRoot(root: string): string {
  const cut = root.lastIndexOf("/");
  const parent = cut > 0 ? root.slice(0, cut) : root;
  return parent.replace(/^\/(Users|home)\/[^/]+/, "~");
}

function countBlocked(projectId: string): number {
  return sessions.value.filter(
    (session) => session.project_id === projectId && session.state === "blocked",
  ).length;
}

function countLive(projectId: string): number {
  return sessions.value.filter(
    (session) => session.project_id === projectId && session.exit_code === null,
  ).length;
}

function waitingElsewhere(): number {
  return sessions.value.filter(
    (session) => session.project_id !== activeProject.value?.id && session.state === "blocked",
  ).length;
}
