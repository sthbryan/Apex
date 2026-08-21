import type { JSX } from "preact";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<JSX.IntrinsicElements["select"], "ref"> {
  options: SelectOption[];
  label: string;
}

export function Select({ options, label, class: className, ...rest }: SelectProps) {
  return (
    <select class={cn("ui-select", className as string)} aria-label={label} {...rest}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
