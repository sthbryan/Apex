import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface AppWindowProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  flush?: boolean;
  children?: ComponentChildren;
}

export function AppWindow({ flush, class: className, children, ...rest }: AppWindowProps) {
  return (
    <div class={cn("ui-app-window", className as string)} data-flush={flush || undefined} {...rest}>
      {children}
    </div>
  );
}

export interface AppBodyProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  children?: ComponentChildren;
}

export function AppBody({ class: className, children, ...rest }: AppBodyProps) {
  return <div class={cn("ui-app-body", className as string)} {...rest}>{children}</div>;
}

export function AppMain({ class: className, children, ...rest }: AppBodyProps) {
  return <main class={cn("ui-app-main", className as string)} {...rest}>{children}</main>;
}
