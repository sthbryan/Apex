import type { JSX } from "preact";
import { cn } from "../../lib/cn";

export type AgentState = "idle" | "working" | "blocked" | "done" | "failed";
export type DotSize = "sm" | "md" | "lg";

export interface DotProps extends Omit<JSX.IntrinsicElements["span"], "size" | "ref"> {
  state: AgentState;
  size?: DotSize;
  pulse?: boolean;
  label?: string;
}

const PULSING: AgentState[] = ["working", "blocked"];

export function Dot({ state, size = "md", pulse, label, class: className, ...rest }: DotProps) {
  const animate = pulse ?? PULSING.includes(state);
  return (
    <span
      class={cn("ui-dot", className as string)}
      data-state={state}
      data-size={size}
      data-pulse={animate || undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      {...rest}
    />
  );
}
