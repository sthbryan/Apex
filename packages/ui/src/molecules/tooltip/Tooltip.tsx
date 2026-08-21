import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: string;
  side?: TooltipSide;
  class?: string;
  children?: ComponentChildren;
}

export function Tooltip({ content, side = "right", class: className, children }: TooltipProps) {
  return (
    <span class={cn("ui-tooltip", className)}>
      {children}
      <span class="ui-tooltip-bubble" role="tooltip" data-side={side}>{content}</span>
    </span>
  );
}
