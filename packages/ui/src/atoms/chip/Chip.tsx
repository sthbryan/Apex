import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type ChipTone = "neutral" | "accent" | "done" | "blocked";

export interface ChipProps extends Omit<JSX.IntrinsicElements["span"], "ref"> {
  tone?: ChipTone;
  children?: ComponentChildren;
}

export function Chip({ tone = "neutral", class: className, children, ...rest }: ChipProps) {
  return <span class={cn("ui-chip", className as string)} data-tone={tone} {...rest}>{children}</span>;
}
