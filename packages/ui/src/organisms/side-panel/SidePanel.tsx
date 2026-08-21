import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface SidePanelProps extends Omit<JSX.IntrinsicElements["aside"], "ref"> {
  head?: ComponentChildren;
  foot?: ComponentChildren;
  side?: "left" | "right";
  width?: number;
  children?: ComponentChildren;
}

export function SidePanel({ head, foot, side = "left", width, class: className, children, ...rest }: SidePanelProps) {
  return (
    <aside
      class={cn("ui-side-panel ui-chrome", className as string)}
      data-side={side}
      style={width ? `--ui-side-panel-width:${width}px` : undefined}
      {...rest}
    >
      {head ? <div class="ui-side-panel-head">{head}</div> : null}
      <div class="ui-side-panel-body">{children}</div>
      {foot ? <div class="ui-side-panel-foot">{foot}</div> : null}
    </aside>
  );
}
