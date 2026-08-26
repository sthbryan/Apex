import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";
import { Button } from "@/atoms/button/Button";

export interface ApprovalCardProps {
  question: string;
  command?: string;
  meta?: string;
  lead?: ComponentChildren;
  approveLabel?: string;
  denyLabel?: string;
  onApprove?: () => void;
  onDeny?: () => void;
  actions?: ComponentChildren;
  settled?: boolean;
  class?: string;
}

export function ApprovalCard({
  question,
  command,
  meta,
  lead,
  approveLabel = "Approve",
  denyLabel = "Deny",
  onApprove,
  onDeny,
  actions,
  settled,
  class: className,
}: ApprovalCardProps) {
  return (
    <section
      class={cn("ui-approval-card", className)}
      data-settled={settled || undefined}
      role="group"
      aria-label={question}
    >
      <div class="ui-approval-card-head">
        {lead ? <span class="ui-approval-card-lead">{lead}</span> : null}
        <span class="ui-approval-card-question">{question}</span>
        {meta ? <span class="ui-approval-card-meta">{meta}</span> : null}
      </div>
      {command ? <code class="ui-approval-card-command">{command}</code> : null}
      <div class="ui-approval-card-actions" hidden={actions === null}>
        {actions === undefined ? (
          <>
            <Button variant="primary" size="sm" onClick={onApprove}>{approveLabel}</Button>
            <Button variant="danger" size="sm" onClick={onDeny}>{denyLabel}</Button>
          </>
        ) : (
          actions
        )}
      </div>
    </section>
  );
}
