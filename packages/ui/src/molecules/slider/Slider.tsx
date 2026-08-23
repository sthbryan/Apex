import type { JSX } from "preact";
import { cn } from "@/lib/cn";

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  format?: (value: number) => string;
  disabled?: boolean;
  class?: string;
}

export function Slider({
  value,
  onChange,
  label,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  format,
  disabled,
  class: className,
}: SliderProps) {
  return (
    <span class={cn("ui-slider", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => onChange(Number(e.currentTarget.value))}
      />
      <span class="ui-slider-value">{format ? format(value) : `${value}${unit}`}</span>
    </span>
  );
}
