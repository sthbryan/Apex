import type { ComponentChildren, JSX, Ref } from "preact";
import { cn } from "@/lib/cn";

export interface ComposerProps
  extends Omit<JSX.IntrinsicElements["form"], "onInput" | "onKeyDown" | "ref"> {
  placeholder?: string;
  label: string;
  rows?: number;
  value?: string;
  elRef?: Ref<HTMLTextAreaElement>;
  onInput?: JSX.GenericEventHandler<HTMLTextAreaElement>;
  onKeyDown?: JSX.KeyboardEventHandler<HTMLTextAreaElement>;
  lead?: ComponentChildren;
  actions?: ComponentChildren;
}

export function Composer({
  placeholder,
  label,
  rows = 2,
  value,
  elRef,
  onInput,
  onKeyDown,
  lead,
  actions,
  class: className,
  ...rest
}: ComposerProps) {
  return (
    <form class={cn("ui-composer", className as string)} {...rest}>
      <textarea
        ref={elRef}
        rows={rows}
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onInput={onInput}
        onKeyDown={onKeyDown}
      />
      <div class="ui-composer-bar">
        {lead}
        <span class="ui-composer-spacer" />
        {actions}
      </div>
    </form>
  );
}
