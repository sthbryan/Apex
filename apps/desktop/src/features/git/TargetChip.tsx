import cn from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";

import type { GitTarget } from "@/bindings/GitTarget";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { WorktreeInfo } from "@/bindings/WorktreeInfo";
import {
  dropWorktree,
  gitStatus,
  gitTarget,
  selectTarget,
  sessionOfWorktree,
  worktrees,
} from "@/features/git/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  project: ProjectSummary;
  placement?: "below" | "above";
};

export function TargetChip({ project, placement = "below" }: Props) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
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
        setAsking(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setAsking(null);
      }
    };
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const onProject = target.type === "project";
  const tree =
    target.type === "worktree"
      ? worktrees.value.find((candidate) => candidate.path === target.path)
      : null;
  const label = onProject ? (status?.branch ?? project.name) : (tree?.branch ?? project.name);
  const owners = sessionOfWorktree.value;
  const attached = worktrees.value.filter((candidate) => owners.has(candidate.path));
  const orphans = worktrees.value.filter((candidate) => !owners.has(candidate.path));
  const above = placement === "above";

  const row = (candidate: WorktreeInfo) => (
    <Target
      key={candidate.path}
      target={{ type: "worktree", path: candidate.path }}
      label={owners.get(candidate.path) ?? shortName(candidate.path)}
      branch={candidate.branch}
      selected={target.type === "worktree" && target.path === candidate.path}
      live={owners.has(candidate.path)}
      onPick={() => setOpen(false)}
      asking={asking === candidate.path}
      onAsk={
        owners.has(candidate.path)
          ? undefined
          : () => setAsking(asking === candidate.path ? null : candidate.path)
      }
      onDrop={() => {
        setAsking(null);
        setOpen(false);
        void dropWorktree(candidate.path, candidate.branch).catch(complain);
      }}
    />
  );

  return (
    <div ref={holder} class="relative min-w-0">
      <button
        type="button"
        title={
          status?.upstream
            ? t("git.chipTracking", { branch: label, upstream: status.upstream })
            : t("git.chip", { branch: label })
        }
        onClick={() => setOpen((shown) => !shown)}
        class={cn(
          "flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-raised px-2 py-px transition-colors hover:border-muted hover:text-text",
          onProject ? "text-muted" : "text-accent",
        )}
      >
        <Icon name={onProject ? "files" : "branch"} size={11} class="shrink-0" />
        <span class="truncate">{label}</span>
        <Icon
          name="chevron"
          size={11}
          class={cn("shrink-0 text-faint transition-transform", { "rotate-180": !above && open })}
        />
      </button>

      {menu.mounted && (
        <div
          ref={menu.holder}
          class={cn(
            "absolute z-50 w-64 overflow-hidden rounded-lg border border-border bg-float shadow-2xl",
            above ? "bottom-full left-0 mb-1" : "top-full right-0 mt-1",
            above
              ? menu.leaving
                ? "animate-rise-out"
                : "animate-rise-in"
              : menu.leaving
                ? "animate-drop-out"
                : "animate-drop-in",
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
            {attached.map(row)}
            {orphans.length > 0 && (
              <li class="px-2 pt-2 pb-0.5 text-tiny uppercase tracking-wider text-faint">
                {t("git.orphanTrees", { count: String(orphans.length) })}
              </li>
            )}
            {orphans.map(row)}
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
  onAsk?: () => void;
  onDrop?: () => void;
  asking?: boolean;
};

function Target({
  target,
  label,
  branch,
  selected,
  live,
  onPick,
  onAsk,
  onDrop,
  asking = false,
}: TargetProps) {
  if (asking && onDrop) {
    return (
      <li class="flex items-center gap-2 bg-raised px-2 py-1">
        <span class="min-w-0 flex-1 truncate text-micro text-muted">
          {t("git.dropWorktreeAsk", { branch })}
        </span>
        <button
          type="button"
          onClick={onDrop}
          class="shrink-0 text-state-failed transition-colors hover:underline"
        >
          {t("git.dropWorktreeYes")}
        </button>
        <button
          type="button"
          onClick={onAsk}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          {t("git.dropWorktreeNo")}
        </button>
      </li>
    );
  }

  return (
    <li class="group relative flex items-center">
      {selected && (
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent"
        />
      )}
      <button
        type="button"
        onClick={() => {
          onPick();
          selectTarget(target);
        }}
        class={cn(
          "flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left transition-colors group-hover:bg-raised",
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
      {onAsk && (
        <button
          type="button"
          title={t("git.dropWorktree", { branch })}
          onClick={onAsk}
          class="shrink-0 px-1.5 py-1 text-faint opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-state-failed"
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </li>
  );
}

function shortName(path: string): string {
  return path.split("/").at(-1) ?? path;
}
