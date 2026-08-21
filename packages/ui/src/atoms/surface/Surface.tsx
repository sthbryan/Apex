import type { ComponentChildren, JSX } from "preact";
import { cn } from "../../lib/cn";

export type Elevation = "bg" | "surface" | "raised" | "overlay" | "tty";
export type SurfaceRadius = "none" | "xs" | "sm" | "md" | "lg" | "xl";
export type SurfaceShadow = "none" | "sm" | "md" | "lg" | "xl";

export interface SurfaceProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  elevation?: Elevation;
  radius?: SurfaceRadius;
  shadow?: SurfaceShadow;
  bordered?: boolean;
  blur?: boolean;
  children?: ComponentChildren;
}

export function Surface({
  elevation = "surface",
  radius = "none",
  shadow = "none",
  bordered = false,
  blur = false,
  class: className,
  children,
  ...rest
}: SurfaceProps) {
  return (
    <div
      class={cn("ui-surface", className as string)}
      data-elevation={elevation}
      data-radius={radius}
      data-shadow={shadow === "none" ? undefined : shadow}
      data-bordered={bordered || undefined}
      data-blur={blur || undefined}
      {...rest}
    >
      {children}
    </div>
  );
}
