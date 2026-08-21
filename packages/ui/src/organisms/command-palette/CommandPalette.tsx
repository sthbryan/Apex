import type { ComponentChildren, JSX } from "preact";
import { useEffect } from "preact/hooks";
import { cn } from "@/lib/cn";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  label?: string;
  placeholder?: string;
  value?: string;
  onInput?: JSX.GenericEventHandler<HTMLInputElement>;
  lead?: ComponentChildren;
  class?: string;
  children?: ComponentChildren;
}

export function CommandPalette({
  open,
  onClose,
  label = "Command palette",
  placeholder = "Search commands…",
  value,
  onInput,
  lead,
  class: className,
  children,
}: CommandPaletteProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div class="ui-command-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class={cn("ui-command-palette", className)} role="dialog" aria-label={label}>
        <div class="ui-command-input">
          {lead}
          <input placeholder={placeholder} aria-label={label} value={value} onInput={onInput} autofocus />
        </div>
        <div class="ui-command-list" role="listbox" aria-label={label}>{children}</div>
      </div>
    </div>
  );
}

export interface CommandItemProps extends Omit<JSX.IntrinsicElements["button"], "ref"> {
  name: string;
  desc?: string;
  selected?: boolean;
  lead?: ComponentChildren;
  trail?: ComponentChildren;
}

export function CommandItem({ name, desc, selected, lead, trail, class: className, ...rest }: CommandItemProps) {
  return (
    <button
      type="button"
      class={cn("ui-command-item", className as string)}
      role="option"
      aria-selected={selected ?? false}
      {...rest}
    >
      {lead}
      <span class="ui-command-item-body">
        <span class="block truncate">{name}</span>
        {desc ? <span class="ui-command-item-desc">{desc}</span> : null}
      </span>
      {trail}
    </button>
  );
}
