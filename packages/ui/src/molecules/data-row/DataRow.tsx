import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export interface DataRowProps {
  label: ComponentChildren;
  sub?: ComponentChildren;
  lead?: ComponentChildren;
  trail?: ComponentChildren;
  actions?: ComponentChildren;
  dim?: boolean;
  class?: string;
}

export function DataRow({ label, sub, lead, trail, actions, dim, class: className }: DataRowProps) {
  return (
    <div class={cn("ui-data-row", className)} data-dim={dim || undefined}>
      {lead ? <span class="ui-data-row-lead">{lead}</span> : null}
      <span class="ui-data-row-text">
        <span class="ui-data-row-label">{label}</span>
        {sub ? <span class="ui-data-row-sub">{sub}</span> : null}
      </span>
      {trail ? <span class="ui-data-row-trail">{trail}</span> : null}
      {actions ? <span class="ui-data-row-actions">{actions}</span> : null}
    </div>
  );
}
