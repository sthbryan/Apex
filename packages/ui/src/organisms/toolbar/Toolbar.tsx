import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export type ToolbarElevation = "bg" | "surface" | "raised";

export interface ToolbarProps {
  title?: string;
  lead?: ComponentChildren;
  trail?: ComponentChildren;
  elevation?: ToolbarElevation;
  bordered?: boolean;
  label?: string;
  class?: string;
  children?: ComponentChildren;
}

export function Toolbar({
  title,
  lead,
  trail,
  elevation = "surface",
  bordered = true,
  label,
  class: className,
  children,
}: ToolbarProps) {
  return (
    <div
      class={cn("ui-toolbar", className)}
      data-elevation={elevation}
      data-bordered={bordered || undefined}
      role="toolbar"
      aria-label={label ?? title}
    >
      {lead}
      {title ? <span class="ui-toolbar-title">{title}</span> : null}
      {children}
      {trail ? <><span class="ui-toolbar-spacer" />{trail}</> : null}
    </div>
  );
}
