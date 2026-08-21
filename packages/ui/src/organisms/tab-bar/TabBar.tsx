import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface TabBarProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  label: string;
  onAdd?: () => void;
  addLabel?: string;
  addIcon?: ComponentChildren;
  children?: ComponentChildren;
}

export function TabBar({ label, onAdd, addLabel = "New tab", addIcon, class: className, children, ...rest }: TabBarProps) {
  return (
    <div class={cn("ui-tab-bar ui-chrome", className as string)} role="tablist" aria-label={label} {...rest}>
      {children}
      {onAdd ? (
        <button type="button" class="ui-tab-add" aria-label={addLabel} title={addLabel} onClick={onAdd}>
          {addIcon ?? "+"}
        </button>
      ) : null}
    </div>
  );
}

export interface TabProps extends Omit<JSX.IntrinsicElements["button"], "ref"> {
  title: string;
  selected?: boolean;
  lead?: ComponentChildren;
  trail?: ComponentChildren;
}

export function Tab({ title, selected, lead, trail, class: className, ...rest }: TabProps) {
  return (
    <button
      type="button"
      class={cn("ui-tab", className as string)}
      role="tab"
      aria-selected={selected ?? false}
      {...rest}
    >
      {lead}
      <span class="ui-tab-title">{title}</span>
      {trail}
    </button>
  );
}
