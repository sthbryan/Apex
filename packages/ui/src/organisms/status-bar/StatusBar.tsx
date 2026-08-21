import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface StatusBarProps extends Omit<JSX.IntrinsicElements["footer"], "ref"> {
  right?: ComponentChildren;
  children?: ComponentChildren;
}

export function StatusBar({ right, class: className, children, ...rest }: StatusBarProps) {
  return (
    <footer class={cn("ui-status-bar ui-chrome", className as string)} {...rest}>
      {children}
      {right ? <div class="ui-status-bar-right">{right}</div> : null}
    </footer>
  );
}

export interface StatusPillProps extends Omit<JSX.IntrinsicElements["button"], "ref"> {
  live?: boolean;
  interactive?: boolean;
  children?: ComponentChildren;
}

export function StatusPill({ live, interactive = true, class: className, children, ...rest }: StatusPillProps) {
  const Tag = (interactive ? "button" : "span") as "button";
  return (
    <Tag
      type={interactive ? "button" : undefined}
      class={cn("ui-status-pill", className as string)}
      data-live={live || undefined}
      {...rest}
    >
      {live ? <span class="ui-status-pill-beacon" /> : null}
      {children}
    </Tag>
  );
}
