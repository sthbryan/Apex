import type { ComponentChildren, JSX } from "preact";
import { cn } from "../../lib/cn";

export interface ChipProps extends Omit<JSX.IntrinsicElements["span"], "ref"> {
  children?: ComponentChildren;
}

export function Chip({ class: className, children, ...rest }: ChipProps) {
  return <span class={cn("ui-chip", className as string)} {...rest}>{children}</span>;
}
