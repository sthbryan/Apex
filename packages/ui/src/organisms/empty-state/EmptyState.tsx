import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  title: string;
  detail?: string;
  icon?: ComponentChildren;
  actions?: ComponentChildren;
  class?: string;
}

export function EmptyState({ title, detail, icon, actions, class: className }: EmptyStateProps) {
  return (
    <div class={cn("ui-empty-state", className)}>
      {icon ? <span class="ui-empty-state-icon" aria-hidden="true">{icon}</span> : null}
      <span class="ui-empty-state-title">{title}</span>
      {detail ? <span class="ui-empty-state-detail">{detail}</span> : null}
      {actions ? <div class="ui-empty-state-actions">{actions}</div> : null}
    </div>
  );
}
