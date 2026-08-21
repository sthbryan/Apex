import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface SectionLabelProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  count?: number | string;
  flush?: boolean;
  children?: ComponentChildren;
}

export function SectionLabel({ count, flush, class: className, children, ...rest }: SectionLabelProps) {
  return (
    <div class={cn("ui-section-label", className as string)} data-flush={flush || undefined} {...rest}>
      <span>{children}</span>
      {count === undefined ? null : <span class="ui-section-label-count">· {count}</span>}
    </div>
  );
}
