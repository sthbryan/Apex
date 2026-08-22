import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export interface IdentityCardProps {
  name: ComponentChildren;
  sub?: ComponentChildren;
  meta?: ComponentChildren;
  icon?: ComponentChildren;
  status?: ComponentChildren;
  action?: ComponentChildren;
  note?: ComponentChildren;
  class?: string;
}

export function IdentityCard({
  name, sub, meta, icon, status, action, note, class: className,
}: IdentityCardProps) {
  return (
    <section class={cn("ui-identity-card", className)}>
      {icon ? <span class="ui-identity-card-icon">{icon}</span> : null}
      <div class="ui-identity-card-id">
        <div class="ui-identity-card-name">
          {name}
          {sub ? <span class="ui-identity-card-sub">{sub}</span> : null}
        </div>
        {meta ? <div class="ui-identity-card-meta">{meta}</div> : null}
        {status}
      </div>
      {action || note ? (
        <div class="ui-identity-card-action">
          {action}
          {note ? <span class="ui-identity-card-note">{note}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
