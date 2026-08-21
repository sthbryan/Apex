import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type CodeToken = "keyword" | "function" | "string" | "comment";

export interface CodeViewProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  children?: ComponentChildren;
}

export function CodeView({ class: className, children, ...rest }: CodeViewProps) {
  return <div class={cn("ui-code-view", className as string)} {...rest}>{children}</div>;
}

export interface CodeLineProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  number?: number;
  children?: ComponentChildren;
}

export function CodeLine({ number, class: className, children, ...rest }: CodeLineProps) {
  return (
    <div class={cn("ui-code-line", className as string)} {...rest}>
      <span class="ui-code-gutter">{number}</span>
      {children}
    </div>
  );
}

export interface CodeTokenProps extends Omit<JSX.IntrinsicElements["span"], "ref"> {
  token: CodeToken;
  children?: ComponentChildren;
}

export function Code({ token, class: className, children, ...rest }: CodeTokenProps) {
  return (
    <span class={cn("ui-code-token", className as string)} data-token={token} {...rest}>{children}</span>
  );
}
