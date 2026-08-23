import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface SidePanelProps extends Omit<JSX.IntrinsicElements["aside"], "ref"> {
  head?: ComponentChildren;
  foot?: ComponentChildren;
  side?: "left" | "right";
  width?: number;
  collapsed?: boolean;
  flush?: boolean;
  children?: ComponentChildren;
}

export function SidePanel({
  head, foot, side = "left", width, collapsed, flush, class: className, children, ...rest
}: SidePanelProps) {
  return (
    <aside
      class={cn("ui-side-panel ui-chrome", className as string)}
      data-side={side}
      data-collapsed={collapsed || undefined}
      inert={collapsed || undefined}
      style={width ? `--ui-side-panel-width:${width}px` : undefined}
      {...rest}
    >
      <div class="ui-side-panel-inner">
        {head ? <div class="ui-side-panel-head">{head}</div> : null}
        <div class="ui-side-panel-body" data-flush={flush || undefined}>{children}</div>
        {foot ? <div class="ui-side-panel-foot">{foot}</div> : null}
      </div>
    </aside>
  );
}
