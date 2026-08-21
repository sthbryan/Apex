import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type WordmarkSize = "sm" | "md" | "lg" | "xl";

export interface WordmarkProps extends Omit<JSX.IntrinsicElements["span"], "size" | "ref"> {
  size?: WordmarkSize;
  children?: ComponentChildren;
}

export function Wordmark({ size = "md", class: className, children, ...rest }: WordmarkProps) {
  return (
    <span class={cn("ui-wordmark", className as string)} data-size={size} {...rest}>{children}</span>
  );
}
