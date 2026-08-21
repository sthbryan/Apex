import { cn } from "@/lib/cn";
import { Bar } from "@/atoms/bar/Bar";
import type { BarTone } from "@/atoms/bar/Bar";

export interface MeterProps {
  label: string;
  value: number;
  tone?: BarTone;
  tick?: number;
  display?: string;
  class?: string;
}

export function Meter({ label, value, tone, tick, display, class: className }: MeterProps) {
  return (
    <div class={cn("ui-meter", className)}>
      <span class="ui-meter-label">{label}</span>
      <Bar value={value} tone={tone} tick={tick} label={label} />
      <span class="ui-meter-value">{display ?? `${Math.round(value)}%`}</span>
    </div>
  );
}
