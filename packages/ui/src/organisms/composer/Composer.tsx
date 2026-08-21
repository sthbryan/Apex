import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface ComposerProps extends Omit<JSX.IntrinsicElements["form"], "onInput" | "ref"> {
  placeholder?: string;
  label: string;
  rows?: number;
  value?: string;
  onInput?: JSX.GenericEventHandler<HTMLTextAreaElement>;
  lead?: ComponentChildren;
  actions?: ComponentChildren;
}

export function Composer({
  placeholder,
  label,
  rows = 2,
  value,
  onInput,
  lead,
  actions,
  class: className,
  ...rest
}: ComposerProps) {
  return (
    <form class={cn("ui-composer", className as string)} {...rest}>
      <textarea rows={rows} placeholder={placeholder} aria-label={label} value={value} onInput={onInput} />
      <div class="ui-composer-bar">
        {lead}
        <span class="ui-composer-spacer" />
        {actions}
      </div>
    </form>
  );
}
