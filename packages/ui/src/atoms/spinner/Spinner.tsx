import type { JSX } from "preact";
import { cn } from "../../lib/cn";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps extends Omit<JSX.IntrinsicElements["span"], "size" | "ref"> {
  size?: SpinnerSize;
  label?: string;
}

export function Spinner({ size = "md", label = "Loading", class: className, ...rest }: SpinnerProps) {
  return (
    <span
      class={cn("ui-spinner", className as string)}
      data-size={size}
      role="status"
      aria-label={label}
      {...rest}
    />
  );
}
