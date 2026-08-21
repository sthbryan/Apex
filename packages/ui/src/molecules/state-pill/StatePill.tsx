import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";
import { Dot } from "@/atoms/dot/Dot";
import type { AgentState } from "@/atoms/dot/Dot";
import { Pill } from "@/atoms/pill/Pill";
import type { PillProps } from "@/atoms/pill/Pill";

export interface StatePillProps extends Omit<PillProps, "tone" | "children"> {
  state: AgentState;
  pulse?: boolean;
  children?: ComponentChildren;
}

export function StatePill({ state, pulse, class: className, children, ...rest }: StatePillProps) {
  return (
    <Pill tone={state} class={cn("ui-state-pill", className as string)} {...rest}>
      <Dot state={state} size="sm" pulse={pulse} />
      {children}
    </Pill>
  );
}
