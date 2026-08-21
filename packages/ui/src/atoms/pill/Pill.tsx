import type { ComponentChildren, JSX } from "preact";
import { cn } from "../../lib/cn";
import type { AgentState } from "../dot/Dot";

export type PillTone = "neutral" | "accent" | AgentState;

export interface PillProps extends Omit<JSX.IntrinsicElements["span"], "ref"> {
  tone?: PillTone;
  children?: ComponentChildren;
}

export function Pill({ tone = "neutral", class: className, children, ...rest }: PillProps) {
  return (
    <span class={cn("ui-pill", className as string)} data-tone={tone} {...rest}>
      {children}
    </span>
  );
}
