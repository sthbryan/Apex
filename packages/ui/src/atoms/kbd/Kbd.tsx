import type { ComponentChildren, JSX } from "preact";
import { cn } from "../../lib/cn";

export interface KbdProps extends Omit<JSX.IntrinsicElements["kbd"], "ref"> {
  children?: ComponentChildren;
}

export function Kbd({ class: className, children, ...rest }: KbdProps) {
  return <kbd class={cn("ui-kbd", className as string)} {...rest}>{children}</kbd>;
}

export interface KbdGroupProps extends Omit<JSX.IntrinsicElements["span"], "ref"> {
  keys: string[];
}

export function KbdGroup({ keys, class: className, ...rest }: KbdGroupProps) {
  return (
    <span class={cn("ui-kbd-group", className as string)} {...rest}>
      {keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
    </span>
  );
}
