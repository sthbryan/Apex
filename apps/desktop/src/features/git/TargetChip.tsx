import { Popover } from "@apex/ui";
import cn from "cnfast";
import { useEffect, useState } from "preact/hooks";

import type { GitBranch } from "@/bindings/GitBranch";
import type { GitTarget } from "@/bindings/GitTarget";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import type { WorktreeEntry } from "@/bindings/WorktreeEntry";
import {
  branches,
  checkoutBranch,
  dropWorktree,
  gitStatus,
  gitTarget,
  readBranches,
  selectTarget,
  sessionOfWorktree,
  worktrees,
} from "@/features/git/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  project: ProjectSummary;
  placement?: "below" | "above";
};

export function TargetChip({ project, placement = "below" }: Props) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const target = gitTarget.value;
  const status = gitStatus.value;

  useEffect(() => {
    if (open) {
      void readBranches();
    } else {
      setAsking(null);
    }
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
  const current = onProject ? status?.branch : tree?.branch;
  const others = branches.value.filter((branch) => branch.name !== current);
  const holderOf = (branch: GitBranch): GitTarget | null => {
    if (!branch.worktree) {
      return null;
    }
    const held = worktrees.value.find((candidate) => candidate.path === branch.worktree);
    return held ? { type: "worktree", path: held.path } : { type: "project" };
  };

  const row = (candidate: WorktreeEntry) => (
    <Target
      key={candidate.path}
      target={{ type: "worktree", path: candidate.path }}
      label={owners.get(candidate.path) ?? shortName(candidate.path)}
      branch={candidate.branch}
      changed={candidate.changed}
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
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      block
      side={above ? "top" : "bottom"}
      align={above ? "start" : "end"}
      width={256}
      label={t("git.branches", { count: String(others.length) })}
      class="min-w-0"
      anchor={
        <button
          type="button"
          title={
            status?.upstream
              ? t("git.chipTracking", { branch: label, upstream: status.upstream })
              : t("git.chip", { branch: label })
          }
          onClick={() => setOpen((shown) => !shown)}
          class={cn(
            "flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-raised px-2 py-0.5 leading-none transition-colors hover:border-muted hover:text-text",
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
      }
    >
      <Target
        target={{ type: "project" }}
        label={project.name}
        branch={onProject ? (status?.branch ?? "") : ""}
        selected={onProject}
        onPick={() => setOpen(false)}
      />
      {attached.map(row)}
      {orphans.length > 0 && (
        <p class="px-1 pt-2 pb-0.5 text-tiny uppercase tracking-wider text-faint">
          {t("git.orphanTrees", { count: String(orphans.length) })}
        </p>
      )}
      {orphans.map(row)}
      <p class="px-1 pt-2 pb-0.5 text-tiny uppercase tracking-wider text-faint">
        {t("git.branches", { count: String(others.length) })}
      </p>
      {others.length === 0 && <p class="px-1 py-1 text-faint">{t("git.branchesEmpty")}</p>}
      {others.map((branch) => {
        const holder = holderOf(branch);
        return (
          <Branch
            key={branch.name}
            branch={branch}
            holder={holder ? shortName(branch.worktree ?? "") : null}
            onPick={() => {
              setOpen(false);
              if (holder) {
                selectTarget(holder);
                return;
              }
              void checkoutBranch(branch.name).catch(complain);
            }}
          />
        );
      })}
    </Popover>
  );
}

type TargetProps = {
  target: GitTarget;
  label: string;
  branch: string;
  changed?: number;
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
  changed = 0,
  selected,
  live,
  onPick,
  onAsk,
  onDrop,
  asking = false,
}: TargetProps) {
  if (asking && onDrop) {
    return (
      <div class="flex items-center gap-2 rounded-sm bg-raised px-1 py-1">
        <span class="min-w-0 flex-1 truncate text-muted">{t("git.dropWorktreeAsk")}</span>
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
      </div>
    );
  }

  return (
    <div class="group relative flex items-center">
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
          "flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-1 text-left transition-colors group-hover:bg-raised",
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
        {changed > 0 && (
          <span
            title={t("git.changed", { count: String(changed) })}
            class="shrink-0 tabular-nums text-git-dirty"
          >
            {changed}
          </span>
        )}
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
    </div>
  );
}

type BranchProps = {
  branch: GitBranch;
  holder: string | null;
  onPick: () => void;
};

function Branch({ branch, holder, onPick }: BranchProps) {
  return (
    <div class="flex items-center">
      <button
        type="button"
        title={
          holder
            ? t("git.branchHeld", { branch: branch.name, worktree: holder })
            : t("git.branchSwitch", { branch: branch.name })
        }
        onClick={onPick}
        class={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-raised hover:text-text",
          holder ? "text-faint" : "text-muted",
        )}
      >
        <Icon name="branch" size={12} class="shrink-0 text-faint" />
        <span class="truncate">{branch.name}</span>
        {holder && <span class="ml-auto shrink-0 truncate text-faint">{holder}</span>}
      </button>
    </div>
  );
}

function shortName(path: string): string {
  return path.split("/").at(-1) ?? path;
}
