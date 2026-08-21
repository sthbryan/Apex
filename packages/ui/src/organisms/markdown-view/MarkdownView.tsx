import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface MarkdownViewProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  children?: ComponentChildren;
}

export function MarkdownView({ class: className, children, ...rest }: MarkdownViewProps) {
  return <div class={cn("ui-markdown-view", className as string)} {...rest}>{children}</div>;
}
