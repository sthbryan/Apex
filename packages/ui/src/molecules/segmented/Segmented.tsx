import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export type SegmentedSize = "sm" | "md" | "lg";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ComponentChildren;
  disabled?: boolean;
  title?: string;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: SegmentedSize;
  disabled?: boolean;
  class?: string;
}

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  disabled,
  class: className,
}: SegmentedProps<T>) {
  return (
    <div class={cn("ui-segmented", className)} data-size={size} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          class="ui-segmented-option"
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled || option.disabled}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
