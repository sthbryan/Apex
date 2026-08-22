import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface BranchBarProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  branch: string;
  ahead?: number;
  behind?: number;
  note?: string;
  lead?: ComponentChildren;
  actions?: ComponentChildren;
}

export function BranchBar({ branch, ahead, behind, note, lead, actions, class: className, ...rest }: BranchBarProps) {
  return (
    <div class={cn("ui-branch-bar", className as string)} {...rest}>
      {lead ? <span class="ui-branch-bar-lead">{lead}</span> : null}
      <span class="ui-branch-bar-name">{branch}</span>
      {ahead ? <span class="ui-branch-bar-ahead">↑{ahead}</span> : null}
      {behind ? <span class="ui-branch-bar-behind">↓{behind}</span> : null}
      {note ? <span class="ui-branch-bar-note">{note}</span> : null}
      {actions ? <span class="ui-branch-bar-actions">{actions}</span> : null}
    </div>
  );
}
