import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type ChipTone = "neutral" | "accent" | "done" | "blocked";

export interface ChipProps extends Omit<JSX.IntrinsicElements["button"], "ref"> {
  tone?: ChipTone;
  as?: "span" | "button";
  children?: ComponentChildren;
}

export function Chip({ tone = "neutral", as = "span", class: className, children, ...rest }: ChipProps) {
  const Tag = as as "button";
  return (
    <Tag
      type={as === "button" ? "button" : undefined}
      class={cn("ui-chip", className as string)}
      data-tone={tone}
      {...rest}
    >
      {children}
    </Tag>
  );
}
