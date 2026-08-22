import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export type NoticeTone = "neutral" | "accent" | "working" | "done" | "blocked" | "failed";

export interface NoticeProps {
  tone?: NoticeTone;
  lead?: ComponentChildren;
  actions?: ComponentChildren;
  stacked?: boolean;
  class?: string;
  children?: ComponentChildren;
}

export function Notice({ tone = "neutral", lead, actions, stacked, class: className, children }: NoticeProps) {
  return (
    <div class={cn("ui-notice", className)} data-tone={tone} data-stacked={stacked || undefined}>
      {lead ? <span class="ui-notice-lead">{lead}</span> : null}
      <span class="ui-notice-text">{children}</span>
      {actions ? <span class="ui-notice-actions">{actions}</span> : null}
    </div>
  );
}
