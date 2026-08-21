import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface ListRowProps extends Omit<JSX.IntrinsicElements["button"], "ref"> {
  label: string;
  sub?: string;
  lead?: ComponentChildren;
  trail?: ComponentChildren;
  selected?: boolean;
  as?: "button" | "div";
}

export function ListRow({
  label,
  sub,
  lead,
  trail,
  selected,
  as = "button",
  disabled,
  class: className,
  ...rest
}: ListRowProps) {
  const Tag = as as "button";
  return (
    <Tag
      type={as === "button" ? "button" : undefined}
      class={cn("ui-list-row", className as string)}
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      disabled={as === "button" ? disabled : undefined}
      {...rest}
    >
      {lead ? <span class="ui-list-row-lead">{lead}</span> : null}
      <span class="ui-list-row-text">
        <span class="ui-list-row-label">{label}</span>
        {sub ? <span class="ui-list-row-sub">{sub}</span> : null}
      </span>
      {trail ? <span class="ui-list-row-trail">{trail}</span> : null}
    </Tag>
  );
}
