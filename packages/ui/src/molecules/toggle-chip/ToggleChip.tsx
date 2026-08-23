import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface ToggleChipProps extends Omit<JSX.IntrinsicElements["button"], "size" | "ref"> {
  pressed: boolean;
  size?: "sm" | "md";
  iconOnly?: boolean;
  lead?: ComponentChildren;
  trail?: ComponentChildren;
  children?: ComponentChildren;
}

export function ToggleChip({ pressed, size = "md", iconOnly, lead, trail, class: className, children, ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      class={cn("ui-toggle-chip", className as string)}
      data-size={size}
      data-icon-only={iconOnly || undefined}
      aria-pressed={pressed}
      {...rest}
    >
      {lead}
      {children}
      {trail}
    </button>
  );
}

export interface ToggleChipGroupProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  label: string;
  children?: ComponentChildren;
}

export function ToggleChipGroup({ label, class: className, children, ...rest }: ToggleChipGroupProps) {
  return (
    <div class={cn("ui-toggle-chip-group", className as string)} role="group" aria-label={label} {...rest}>
      {children}
    </div>
  );
}
