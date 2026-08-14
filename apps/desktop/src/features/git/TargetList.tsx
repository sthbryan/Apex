import cn from "cnfast";

import type { GitTarget } from "@/bindings/GitTarget";
import type { ProjectSummary } from "@/bindings/ProjectSummary";
import {
  gitStatus,
  gitTarget,
  selectTarget,
  sessionOfWorktree,
  worktrees,
} from "@/features/git/state";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  project: ProjectSummary;
};

export function TargetList({ project }: Props) {
  const target = gitTarget.value;
  const status = gitStatus.value;

  return (
    <ul class="shrink-0 border-b border-border pb-1">
      <Target
        target={{ type: "project" }}
        label={project.name}
        branch={target.type === "project" ? (status?.branch ?? "") : ""}
        selected={target.type === "project"}
      />
      {worktrees.value.map((tree) => (
        <Target
          key={tree.path}
          target={{ type: "worktree", path: tree.path }}
          label={sessionOfWorktree.value.get(tree.path) ?? shortName(tree.path)}
          branch={tree.branch}
          selected={target.type === "worktree" && target.path === tree.path}
          live={sessionOfWorktree.value.has(tree.path)}
        />
      ))}
    </ul>
  );
}

type TargetProps = {
  target: GitTarget;
  label: string;
  branch: string;
  selected: boolean;
  live?: boolean;
};

function Target({ target, label, branch, selected, live }: TargetProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => selectTarget(target)}
        class={cn(
          "flex w-full items-center gap-2 px-2 py-px text-left transition-colors hover:bg-raised",
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
