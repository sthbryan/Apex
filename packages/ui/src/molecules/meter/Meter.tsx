import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";
import { Bar } from "@/atoms/bar/Bar";
import type { BarTone } from "@/atoms/bar/Bar";

export interface MeterProps {
  label: string;
  value: number;
  tone?: BarTone;
  tick?: number;
  display?: string;
  lead?: ComponentChildren;
  detail?: ComponentChildren;
  class?: string;
}

export function Meter({ label, value, tone, tick, display, lead, detail, class: className }: MeterProps) {
  return (
    <div class={cn("ui-meter", className)} data-tone={tone}>
      {lead ? <span class="ui-meter-lead">{lead}</span> : null}
      <span class="ui-meter-label">{label}</span>
      <Bar value={value} tone={tone} tick={tick} label={label} />
      {display === "" ? null : <span class="ui-meter-value">{display ?? `${Math.round(value)}%`}</span>}
      {detail ? <span class="ui-meter-detail">{detail}</span> : null}
    </div>
  );
}
