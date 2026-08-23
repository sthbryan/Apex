import { Button, Chip, ListRow, Notice, Popover, SectionLabel, StatusPill } from "@apex/ui";
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
      anchorClass="min-w-0 shrink"
      side={above ? "top" : "bottom"}
      align={above ? "start" : "end"}
      width={256}
      label={t("git.branches", { count: String(others.length) })}
      anchor={
        <StatusPill
          class={cn("min-w-0", onProject ? undefined : "text-accent")}
          title={
            status?.upstream
              ? t("git.chipTracking", { branch: label, upstream: status.upstream })
              : t("git.chip", { branch: label })
          }
          onClick={() => setOpen((shown) => !shown)}
        >
          <Icon name={onProject ? "files" : "branch"} size={11} class="shrink-0" />
          <span class="truncate font-mono">{label}</span>
          {status && status.ahead > 0 && (
            <span class="shrink-0 font-mono tabular-nums text-git-ahead">↑{status.ahead}</span>
          )}
          {status && status.behind > 0 && (
            <span class="shrink-0 font-mono tabular-nums text-git-behind">↓{status.behind}</span>
          )}
          <Icon
            name="chevron"
            size={11}
            class={cn("shrink-0 text-faint transition-transform", { "rotate-180": !above && open })}
          />
        </StatusPill>
      }
    >
      <Target
        target={{ type: "project" }}
        label={project.name}
        branch={onProject ? (status?.branch ?? "") : ""}
        selected={onProject}
        onPick={() => setOpen(false)}
      />
      {attached.length > 0 && (
        <SectionLabel flush count={attached.length}>
          {t("git.worktrees")}
        </SectionLabel>
      )}
      {attached.map(row)}
      {orphans.length > 0 && (
        <SectionLabel flush count={orphans.length}>
          {t("git.orphanTreesLabel")}
        </SectionLabel>
      )}
      {orphans.map(row)}
      <SectionLabel flush count={others.length}>
        {t("git.branchesLabel")}
      </SectionLabel>
      {others.length === 0 && <p class="px-1.5 py-1 text-faint">{t("git.branchesEmpty")}</p>}
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
      <Notice
        tone="failed"
        actions={
          <>
            <Button variant="subtle" size="xs" onClick={onAsk}>
              {t("git.dropWorktreeNo")}
            </Button>
            <Button variant="danger" size="xs" onClick={onDrop}>
              {t("git.dropWorktreeYes")}
            </Button>
          </>
        }
      >
        {t("git.dropWorktreeAsk")}
      </Notice>
    );
  }

  return (
    <ListRow
      label={label}
      sub={branch ? <span class="font-mono">{branch}</span> : undefined}
      selected={selected}
      lead={
        <Icon
          name={target.type === "project" ? "files" : "branch"}
          size={12}
          class={live ? "text-state-working" : "text-faint"}
        />
      }
      trail={
        <>
          {changed > 0 && (
            <span
              title={t("git.changed", { count: String(changed) })}
              class="tabular-nums text-git-dirty"
            >
              {changed}
            </span>
          )}
          {target.type === "project" && <Chip>{t("git.projectTarget")}</Chip>}
        </>
      }
      actions={
        onAsk ? (
          <Button
            variant="subtle"
            size="xs"
            iconOnly
            title={t("git.dropWorktree", { branch })}
            aria-label={t("git.dropWorktree", { branch })}
            onClick={(event) => {
              event.stopPropagation();
              onAsk();
            }}
          >
            <Icon name="close" size={11} />
          </Button>
        ) : undefined
      }
      onClick={() => {
        onPick();
        selectTarget(target);
      }}
    />
  );
}

type BranchProps = {
  branch: GitBranch;
  holder: string | null;
  onPick: () => void;
};

function Branch({ branch, holder, onPick }: BranchProps) {
  return (
    <ListRow
      label={branch.name}
      mono
      class={holder ? "text-faint" : undefined}
      title={
        holder
          ? t("git.branchHeld", { branch: branch.name, worktree: holder })
          : t("git.branchSwitch", { branch: branch.name })
      }
      lead={<Icon name="branch" size={12} class="text-faint" />}
      trail={holder ? <span class="truncate">{holder}</span> : undefined}
      onClick={onPick}
    />
  );
}

function shortName(path: string): string {
  return path.split("/").at(-1) ?? path;
}
