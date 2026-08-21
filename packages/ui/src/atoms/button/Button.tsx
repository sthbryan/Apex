import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";
import { Spinner } from "@/atoms/spinner/Spinner";

export type ButtonVariant = "primary" | "ghost" | "subtle" | "danger" | "dashed";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends Omit<JSX.IntrinsicElements["button"], "size" | "ref"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
  children?: ComponentChildren;
}

export function Button({
  variant = "ghost",
  size = "md",
  loading = false,
  iconOnly = false,
  disabled,
  class: className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      class={cn("ui-button", loading && "relative", className as string)}
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      data-icon-only={iconOnly || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner class="ui-button-spinner" size="sm" /> : null}
      <span class="ui-button-content">{children}</span>
    </button>
  );
}
