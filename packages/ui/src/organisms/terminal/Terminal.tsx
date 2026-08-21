import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface TerminalProps extends Omit<JSX.IntrinsicElements["pre"], "ref"> {
  cursor?: boolean;
  label?: string;
  children?: ComponentChildren;
}

export function Terminal({ cursor, label = "Terminal output", class: className, children, ...rest }: TerminalProps) {
  return (
    <pre class={cn("ui-terminal", className as string)} role="log" aria-label={label} {...rest}>
      {children}
      {cursor ? <span class="ui-terminal-cursor" /> : null}
    </pre>
  );
}
