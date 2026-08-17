import cn from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";

import type { GitTarget } from "@/bindings/GitTarget";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import {
  gitStatus,
  gitTarget,
  selectTarget,
  sessionOfWorktree,
  worktrees,
} from "@/features/git/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  project: ProjectSummary;
};

export function TargetChip({ project }: Props) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const menu = usePresence<HTMLDivElement>(open);
  const target = gitTarget.value;
  const status = gitStatus.value;

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

  const onProject = target.type === "project";
  const tree =
    target.type === "worktree"
      ? worktrees.value.find((candidate) => candidate.path === target.path)
      : null;
  const label = onProject ? (status?.branch ?? project.name) : (tree?.branch ?? project.name);

  return (
    <div ref={holder} class="relative min-w-0">
      <button
        type="button"
        title={t("git.target")}
        onClick={() => setOpen((shown) => !shown)}
        class="flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-raised px-2 py-px text-muted transition-colors hover:border-muted hover:text-text"
      >
        <Icon name={onProject ? "files" : "branch"} size={11} class="shrink-0 text-faint" />
        <span class="truncate">{label}</span>
        <Icon
          name="chevron"
          size={11}
          class={cn("shrink-0 text-faint transition-transform", { "rotate-180": open })}
        />
      </button>

      {menu.mounted && (
        <div
          ref={menu.holder}
          class={cn(
            "absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-overlay shadow-2xl",
            {
              "animate-drop-out": menu.leaving,
              "animate-drop-in": !menu.leaving,
            },
          )}
        >
          <ul class="max-h-72 overflow-y-auto py-1">
            <Target
              target={{ type: "project" }}
              label={project.name}
              branch={onProject ? (status?.branch ?? "") : ""}
              selected={onProject}
              onPick={() => setOpen(false)}
            />
            {worktrees.value.map((candidate) => (
              <Target
                key={candidate.path}
                target={{ type: "worktree", path: candidate.path }}
                label={sessionOfWorktree.value.get(candidate.path) ?? shortName(candidate.path)}
                branch={candidate.branch}
                selected={target.type === "worktree" && target.path === candidate.path}
                live={sessionOfWorktree.value.has(candidate.path)}
                onPick={() => setOpen(false)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type TargetProps = {
  target: GitTarget;
  label: string;
  branch: string;
  selected: boolean;
  live?: boolean;
  onPick: () => void;
};

function Target({ target, label, branch, selected, live, onPick }: TargetProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onPick();
          selectTarget(target);
        }}
        class={cn(
          "flex w-full items-center gap-2 px-2 py-1 text-left transition-colors hover:bg-raised",
          selected ? "bg-raised text-text" : "text-muted",
        )}
      >
        <Icon
          name={target.type === "project" ? "files" : "branch"}
          size={12}
          class={cn("shrink-0", live ? "text-state-working" : "text-faint")}
        />
        <span class="truncate">{label}</span>
        {branch && <span class="ml-auto shrink-0 truncate text-faint">{branch}</span>}
      </button>
    </li>
  );
}

function shortName(path: string): string {
  return path.split("/").at(-1) ?? path;
}
