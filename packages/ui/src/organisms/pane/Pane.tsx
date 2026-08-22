import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface PaneProps extends Omit<JSX.IntrinsicElements["article"], "title" | "ref"> {
  title?: string;
  sub?: ComponentChildren;
  lead?: ComponentChildren;
  actions?: ComponentChildren;
  foot?: ComponentChildren;
  scroll?: boolean;
  children?: ComponentChildren;
}

export function Pane({ title, sub, lead, actions, foot, scroll = true, class: className, children, ...rest }: PaneProps) {
  const head = title || lead || actions;
  return (
    <article class={cn("ui-pane", className as string)} {...rest}>
      {head ? (
        <header class="ui-pane-head">
          {lead}
          {title ? (
            <div class="ui-pane-heading">
              <div class="ui-pane-title">{title}</div>
              {sub ? <div class="ui-pane-sub">{sub}</div> : null}
            </div>
          ) : null}
          {actions}
        </header>
      ) : null}
      {scroll ? <div class="ui-pane-body">{children}</div> : children}
      {foot ? <div class="ui-pane-foot">{foot}</div> : null}
    </article>
  );
}

export interface PaneGridProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  min?: number;
  children?: ComponentChildren;
}

export function PaneGrid({ min, class: className, children, ...rest }: PaneGridProps) {
  return (
    <div
      class={cn("ui-pane-grid", className as string)}
      style={min ? `--ui-pane-min:${min}px` : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

export type PaneAxis = "row" | "col";

export interface PaneSplitProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  axis?: PaneAxis;
  children?: ComponentChildren;
}

export function PaneSplit({ axis = "row", class: className, children, ...rest }: PaneSplitProps) {
  return (
    <div class={cn("ui-pane ui-pane-split", className as string)} data-axis={axis} {...rest}>
      {children}
    </div>
  );
}
