import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface TitleBarProps extends Omit<JSX.IntrinsicElements["header"], "title" | "ref"> {
  title?: ComponentChildren;
  lights?: boolean;
  actions?: ComponentChildren;
  children?: ComponentChildren;
}

export function TitleBar({ title, lights = true, actions, class: className, children, ...rest }: TitleBarProps) {
  return (
    <header class={cn("ui-title-bar ui-chrome", className as string)} {...rest}>
      {lights ? <span class="ui-title-bar-lights" aria-hidden="true"><i /><i /><i /></span> : null}
      {title ? <div class="ui-title-bar-title">{title}</div> : null}
      {children}
      {actions ? <div class="ui-title-bar-actions">{actions}</div> : null}
    </header>
  );
}
