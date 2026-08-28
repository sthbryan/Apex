import type { JSX } from "preact";
import { useRef } from "preact/hooks";
import { Button } from "@/atoms/button/Button";
import { cn } from "@/lib/cn";

export interface QuestionOption {
  id: string;
  label: string;
  hint?: string;
}

export interface QuestionMark {
  label: string;
  answered: boolean;
  here: boolean;
}

export interface QuestionCardProps {
  question: string;
  options: QuestionOption[];
  answer?: string | null;
  picked?: string | null;
  own?: string;
  count?: string;
  marks?: QuestionMark[];
  sent?: boolean;
  ownLabel?: string;
  ownPlaceholder?: string;
  skipLabel?: string;
  backLabel?: string;
  submitLabel?: string;
  answeredLabel?: string;
  sendingLabel?: string;
  dismissLabel?: string;
  onPick?: (id: string | null) => void;
  onOwn?: (text: string) => void;
  onAnswer?: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  onJump?: (at: number) => void;
  onDismiss?: () => void;
  class?: string;
}

export const OWN = " own";

export function QuestionCard({
  question,
  options,
  answer,
  picked = null,
  own = "",
  count,
  marks,
  sent,
  ownLabel = "Other",
  ownPlaceholder = "Type your own answer here",
  skipLabel = "Skip",
  backLabel = "Back",
  submitLabel = "Submit",
  answeredLabel = "Answered",
  sendingLabel = "Sending…",
  dismissLabel = "Leave them all",
  onPick,
  onOwn,
  onAnswer,
  onSkip,
  onBack,
  onJump,
  onDismiss,
  class: className,
}: QuestionCardProps) {
  const field = useRef<HTMLInputElement>(null);
  const settled = answer !== undefined && answer !== null;

  if (settled) {
    return (
      <section class={cn("ui-question", className)} data-settled>
        <div class="ui-question-head">
          <span class="ui-question-title">{question}</span>
          <span class="ui-question-answer">
            {answeredLabel}: {answer}
          </span>
        </div>
      </section>
    );
  }

  const rows: QuestionOption[] = [...options, { id: OWN, label: ownLabel }];
  const ready = picked === OWN ? own.trim().length > 0 : picked !== null;

  const take = (index: number) => {
    const row = rows[index];
    if (!row) {
      return;
    }
    onPick?.(row.id);
    if (row.id === OWN) {
      window.setTimeout(() => field.current?.focus(), 0);
    }
  };

  return (
    <section
      class={cn("ui-question", className)}
      data-sent={sent || undefined}
      role="group"
      aria-label={question}
      onKeyDown={(event: JSX.TargetedKeyboardEvent<HTMLElement>) => {
        if (
          event.key >= "1" &&
          event.key <= "9" &&
          (event.target as HTMLElement).tagName !== "INPUT"
        ) {
          event.preventDefault();
          take(Number(event.key) - 1);
        }
      }}
    >
      <div class="ui-question-head">
        <span class="ui-question-title">{question}</span>
        {onDismiss ? (
          <button
            type="button"
            class="ui-question-dismiss"
            aria-label={dismissLabel}
            onClick={onDismiss}
          />
        ) : null}
      </div>

      {marks && marks.length > 1 ? (
        <ol class="ui-question-marks">
          <li class="ui-question-count">{count}</li>
          {marks.map((mark, index) => (
            <li key={mark.label}>
              <button
                type="button"
                class="ui-question-mark"
                title={mark.label}
                aria-current={mark.here}
                data-here={mark.here || undefined}
                data-answered={mark.answered || undefined}
                onClick={() => onJump?.(index)}
              >
                {index + 1}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <ul class="ui-question-rows">
        {rows.map((row, index) => (
          <li key={row.id}>
            <button
              type="button"
              class="ui-question-row"
              data-picked={picked === row.id || undefined}
              aria-pressed={picked === row.id}
              onClick={() => take(index)}
            >
              <span class="ui-question-row-text">
                <span class="ui-question-row-label">{row.label}</span>
                {row.hint ? <span class="ui-question-row-hint">{row.hint}</span> : null}
              </span>
              <span class="ui-question-row-key">{index + 1}</span>
            </button>
            {row.id === OWN && picked === OWN ? (
              <input
                ref={field}
                class="ui-question-own"
                value={own}
                spellcheck={false}
                aria-label={ownLabel}
                placeholder={ownPlaceholder}
                onInput={(event: JSX.TargetedEvent<HTMLInputElement>) =>
                  onOwn?.(event.currentTarget.value)
                }
                onKeyDown={(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Enter" && event.currentTarget.value.trim()) {
                    event.preventDefault();
                    onAnswer?.();
                  }
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <div class="ui-question-foot">
        {onBack ? (
          <Button size="sm" variant="subtle" onClick={onBack}>
            {backLabel}
          </Button>
        ) : null}
        <Button size="sm" variant="subtle" onClick={onSkip}>
          {skipLabel}
        </Button>
        <button
          type="button"
          class="ui-button ui-question-send"
          data-size="sm"
          data-variant="primary"
          aria-disabled={!ready || sent ? "true" : "false"}
          onClick={() => {
            if (!sent) {
              onAnswer?.();
            }
          }}
        >
          {sent ? sendingLabel : submitLabel}
        </button>
      </div>
    </section>
  );
}
