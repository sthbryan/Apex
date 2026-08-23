import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface SectionLabelProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  count?: number | string;
  flush?: boolean;
  action?: ComponentChildren;
  children?: ComponentChildren;
}

export function SectionLabel({ count, flush, action, class: className, children, ...rest }: SectionLabelProps) {
  return (
    <div class={cn("ui-section-label", className as string)} data-flush={flush || undefined} {...rest}>
      <span>{children}</span>
      <span class="ui-section-label-end">
        {count === undefined ? null : <span class="ui-section-label-count">· {count}</span>}
        {action}
      </span>
    </div>
  );
}
