import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface PaneProps extends Omit<JSX.IntrinsicElements["article"], "title" | "ref"> {
  title?: ComponentChildren;
  sub?: ComponentChildren;
  lead?: ComponentChildren;
  controls?: ComponentChildren;
  actions?: ComponentChildren;
  foot?: ComponentChildren;
  scroll?: boolean;
  wide?: boolean;
  children?: ComponentChildren;
}

export function Pane({ title, sub, lead, controls, actions, foot, scroll = true, wide, class: className, children, ...rest }: PaneProps) {
  const head = title || lead || controls || actions;
  return (
    <article class={cn("ui-pane", className as string)} {...rest}>
      {head ? (
        <header class="ui-pane-head">
          {lead}
          {title ? (
            <div class="ui-pane-heading" data-wide={wide || undefined}>
              <span class="ui-pane-title">{title}</span>
              {sub ? <span class="ui-pane-sub">{sub}</span> : null}
            </div>
          ) : null}
          {controls || actions ? (
            <div class="ui-pane-tools">
              {controls}
              {controls && actions ? <span class="ui-pane-divider" /> : null}
              {actions}
            </div>
          ) : null}
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
