import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface MenuProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  label?: string;
  children?: ComponentChildren;
}

export function Menu({ label, class: className, children, ...rest }: MenuProps) {
  return (
    <div class={cn("ui-menu", className as string)} role="menu" aria-label={label} {...rest}>
      {children}
    </div>
  );
}

export interface MenuItemProps extends Omit<JSX.IntrinsicElements["button"], "ref"> {
  lead?: ComponentChildren;
  hint?: ComponentChildren;
  danger?: boolean;
  children?: ComponentChildren;
}

export function MenuItem({ lead, hint, danger, class: className, children, ...rest }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      class={cn("ui-menu-item", className as string)}
      data-danger={danger || undefined}
      {...rest}
    >
      {lead ? <span class="ui-menu-lead">{lead}</span> : null}
      <span class="ui-menu-name">{children}</span>
      {hint ? <span class="ui-menu-hint">{hint}</span> : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div class="ui-menu-rule" role="separator" />;
}
