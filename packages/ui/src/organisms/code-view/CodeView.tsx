import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type CodeToken = "keyword" | "function" | "string" | "comment";

export interface CodeViewProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  lines?: number;
  children?: ComponentChildren;
}

export function CodeView({ lines, class: className, children, ...rest }: CodeViewProps) {
  return (
    <div class={cn("ui-code-view", className as string)} {...rest}>
      {lines ? (
        <div aria-hidden="true" class="ui-code-numbers">
          {Array.from({ length: lines }, (_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
      ) : null}
      <div class="ui-code-body">{children}</div>
    </div>
  );
}

export interface CodeLineProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  children?: ComponentChildren;
}

export function CodeLine({ class: className, children, ...rest }: CodeLineProps) {
  return <div class={cn("ui-code-line", className as string)} {...rest}>{children}</div>;
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
