import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";
import { Bar } from "@/atoms/bar/Bar";
import type { BarTone } from "@/atoms/bar/Bar";

export interface MeterProps extends Omit<JSX.IntrinsicElements["div"], "label" | "ref"> {
  label: string;
  value: number;
  tone?: BarTone;
  tick?: number;
  display?: string;
  lead?: ComponentChildren;
  detail?: ComponentChildren;
  class?: string;
}

export function Meter({ label, value, tone, tick, display, lead, detail, class: className, ...rest }: MeterProps) {
  return (
    <div class={cn("ui-meter", className as string)} data-tone={tone} {...rest}>
      {lead ? <span class="ui-meter-lead">{lead}</span> : null}
      <span class="ui-meter-label">{label}</span>
      <Bar value={value} tone={tone} tick={tick} label={label} />
      {display === "" ? null : <span class="ui-meter-value">{display ?? `${Math.round(value)}%`}</span>}
      {detail === undefined ? null : <span class="ui-meter-detail">{detail}</span>}
    </div>
  );
}
