import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";
import { Button } from "@/atoms/button/Button";

export type ToastTone = "accent" | "done" | "failed" | "blocked";

export interface ToastProps extends Omit<JSX.IntrinsicElements["div"], "title" | "ref"> {
  title: ComponentChildren;
  detail?: ComponentChildren;
  tone?: ToastTone;
  lead?: ComponentChildren;
  actions?: ComponentChildren;
  duration?: number;
  onDismiss?: () => void;
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
  style,
  ...rest
}: ToastProps) {
  return (
    <div
      class={cn("ui-toast", className as string)}
      data-tone={tone}
      role="status"
      aria-live="polite"
      style={{ ...(style as object), "--ui-toast-duration": duration ? `${duration}ms` : undefined }}
      {...rest}
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

export interface ToastStackProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  children?: ComponentChildren;
}

export function ToastStack({ class: className, children, ...rest }: ToastStackProps) {
  return (
    <div class={cn("ui-toast-stack", className as string)} {...rest}>
      {children}
    </div>
  );
}
