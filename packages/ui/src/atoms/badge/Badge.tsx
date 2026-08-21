import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type BadgeTone = "accent" | "neutral" | "added" | "removed" | "modified";

export interface BadgeProps extends Omit<JSX.IntrinsicElements["span"], "ref"> {
  tone?: BadgeTone;
  children?: ComponentChildren;
}

export function Badge({ tone = "accent", class: className, children, ...rest }: BadgeProps) {
  return (
    <span class={cn("ui-badge", className as string)} data-tone={tone} {...rest}>
      {children}
    </span>
  );
}
