import type { ComponentChildren } from "preact";
import type { JSX } from "preact";
import { cn } from "@/lib/cn";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  mark?: ComponentChildren;
  class?: string;
}

export function Checkbox({ checked, onChange, label, disabled, mark, class: className }: CheckboxProps) {
  return (
    <span class={cn("ui-checkbox", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => onChange(e.currentTarget.checked)}
      />
      {mark ?? "✓"}
    </span>
  );
}
