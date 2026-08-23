import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";
import { Button } from "@/atoms/button/Button";

export type CommitHintTone = "muted" | "blocked" | "failed";

export interface CommitBoxProps {
  value?: string;
  placeholder?: string;
  hint?: string;
  hintTone?: CommitHintTone;
  submitLabel?: string;
  submitDisabled?: boolean;
  rows?: number;
  label?: string;
  actions?: ComponentChildren;
  class?: string;
  onInput?: JSX.GenericEventHandler<HTMLTextAreaElement>;
  onSubmit?: (event: Event) => void;
}

export function CommitBox({
  value,
  placeholder = "Commit message…",
  hint,
  hintTone = "muted",
  submitLabel = "Commit",
  submitDisabled,
  rows = 2,
  label = "Commit message",
  actions,
  class: className,
  onInput,
  onSubmit,
}: CommitBoxProps) {
  const submit = (event: Event) => {
    event.preventDefault();
    if (!submitDisabled) {
      onSubmit?.(event);
    }
  };

  return (
    <form class={cn("ui-commit-box", className)} onSubmit={submit}>
      <textarea
        class="ui-commit-box-input"
        aria-label={label}
        placeholder={placeholder}
        rows={rows}
        value={value}
        onInput={onInput}
        onKeyDown={(event: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            submit(event);
          }
        }}
      />
      <div class="ui-commit-box-foot">
        {hint ? <span class="ui-commit-box-hint" data-tone={hintTone}>{hint}</span> : null}
        {actions}
        <Button type="submit" variant="primary" size="sm" disabled={submitDisabled}>{submitLabel}</Button>
      </div>
    </form>
  );
}
