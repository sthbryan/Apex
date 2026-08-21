import type { JSX } from "preact";
import { cn } from "../../lib/cn";

export type BarTone = "accent" | "done" | "blocked" | "failed";
export type BarSize = "sm" | "md" | "lg";

export interface BarProps extends Omit<JSX.IntrinsicElements["div"], "size" | "ref"> {
  value: number;
  tone?: BarTone;
  size?: BarSize;
  tick?: number;
  label?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function Bar({ value, tone = "accent", size = "md", tick, label, class: className, ...rest }: BarProps) {
  const pct = clamp(value);
  return (
    <div
      class={cn("ui-bar", className as string)}
      data-tone={tone}
      data-size={size}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      {...rest}
    >
      <span class="ui-bar-fill" style={`width:${pct}%`} />
      {tick === undefined ? null : <span class="ui-bar-tick" style={`left:${clamp(tick)}%`} />}
    </div>
  );
}
