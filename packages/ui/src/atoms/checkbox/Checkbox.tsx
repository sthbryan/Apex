import type { ComponentChildren } from "preact";
import type { JSX } from "preact";
import { cn } from "@/lib/cn";

const CHECK = (
  <svg class="ui-checkbox-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

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
      {mark ?? CHECK}
    </span>
  );
}
