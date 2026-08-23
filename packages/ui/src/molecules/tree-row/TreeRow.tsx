import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type TreeStatus = "added" | "modified" | "removed" | "untracked" | "conflicted";

export interface TreeRowProps extends Omit<JSX.IntrinsicElements["button"], "ref"> {
  name: string;
  depth?: number;
  expanded?: boolean;
  status?: TreeStatus;
  selected?: boolean;
  lead?: ComponentChildren;
  trail?: ComponentChildren;
}

const LETTER: Record<TreeStatus, string> = {
  added: "A",
  modified: "M",
  removed: "D",
  untracked: "U",
  conflicted: "C",
};

export function TreeRow({
  name,
  depth = 0,
  expanded,
  status,
  selected,
  lead,
  trail,
  class: className,
  ...rest
}: TreeRowProps) {
  return (
    <button
      type="button"
      class={cn("ui-tree-row", className as string)}
      style={`--ui-tree-depth:${depth}`}
      aria-selected={selected}
      aria-expanded={expanded}
      {...rest}
    >
      <span class="ui-tree-row-twisty" data-leaf={expanded === undefined || undefined}>
        {expanded === undefined ? null : (
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        )}
      </span>
      {lead ? <span class="ui-tree-row-lead">{lead}</span> : null}
      <span class="ui-tree-row-name">{name}</span>
      {status ? <span class="ui-tree-row-status" data-status={status}>{LETTER[status]}</span> : null}
      {trail ? <span class="ui-tree-row-trail">{trail}</span> : null}
    </button>
  );
}
