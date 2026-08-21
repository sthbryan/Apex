import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";
import { Button } from "@/atoms/button/Button";

export type ToastTone = "accent" | "done" | "failed" | "blocked";

export interface ToastProps {
  title: string;
  detail?: string;
  tone?: ToastTone;
  lead?: ComponentChildren;
  actions?: ComponentChildren;
  duration?: number;
  onDismiss?: () => void;
  class?: string;
}

export function Toast({
  title,
  detail,
  tone = "accent",
  lead,
  actions,
  duration,
  onDismiss,
  class: className,
}: ToastProps) {
  return (
    <div
      class={cn("ui-toast", className)}
      data-tone={tone}
      role="status"
      aria-live="polite"
      style={duration ? `--ui-toast-duration:${duration}ms` : undefined}
    >
      {lead}
      <div class="ui-toast-text">
        <div class="ui-toast-title">{title}</div>
        {detail ? <div class="ui-toast-detail">{detail}</div> : null}
      </div>
      {actions}
      {onDismiss ? (
        <Button variant="subtle" size="xs" iconOnly aria-label="Dismiss" onClick={onDismiss}>×</Button>
      ) : null}
      {duration ? <span class="ui-toast-progress" /> : null}
    </div>
  );
}

export interface ToastStackProps {
  class?: string;
  children?: ComponentChildren;
}

export function ToastStack({ class: className, children }: ToastStackProps) {
  return <div class={cn("ui-toast-stack", className)}>{children}</div>;
}
