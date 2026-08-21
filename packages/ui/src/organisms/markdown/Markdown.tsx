import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface MarkdownProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  children?: ComponentChildren;
}

export function Markdown({ class: className, children, ...rest }: MarkdownProps) {
  return <div class={cn("ui-markdown", className as string)} {...rest}>{children}</div>;
}
