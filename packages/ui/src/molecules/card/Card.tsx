import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";
import { Surface } from "@/atoms/surface/Surface";
import type { SurfaceProps } from "@/atoms/surface/Surface";

export interface CardProps extends Omit<SurfaceProps, "title"> {
  title?: string;
  lead?: ComponentChildren;
  actions?: ComponentChildren;
  children?: ComponentChildren;
}

export function Card({
  title,
  lead,
  actions,
  elevation = "overlay",
  radius = "md",
  bordered = true,
  class: className,
  children,
  ...rest
}: CardProps) {
  return (
    <Surface
      elevation={elevation}
      radius={radius}
      bordered={bordered}
      class={cn("ui-card", className as string)}
      {...rest}
    >
      {title || lead || actions ? (
        <div class="ui-card-head">
          {lead}
          {title ? <span class="ui-card-title">{title}</span> : null}
          {actions}
        </div>
      ) : null}
      {children ? <div class="ui-card-body">{children}</div> : null}
    </Surface>
  );
}
