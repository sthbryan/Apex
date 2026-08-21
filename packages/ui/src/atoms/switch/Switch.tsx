import type { JSX } from "preact";
import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  labelHidden?: boolean;
  disabled?: boolean;
  class?: string;
}

export function Switch({ checked, onChange, label, labelHidden = true, disabled, class: className }: SwitchProps) {
  const input = (
    <span class={cn("ui-switch", className)}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={labelHidden ? label : undefined}
        onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => onChange(e.currentTarget.checked)}
      />
      <span class="ui-switch-track" />
    </span>
  );
  if (labelHidden) return input;
  return (
    <label class="inline-flex items-center gap-2">
      {input}
      <span>{label}</span>
    </label>
  );
}
