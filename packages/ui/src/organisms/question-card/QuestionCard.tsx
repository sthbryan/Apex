import type { JSX } from "preact";
import { useRef } from "preact/hooks";
import { Button } from "@/atoms/button/Button";
import { cn } from "@/lib/cn";

export interface QuestionOption {
  id: string;
  label: string;
  hint?: string;
}

export interface AskedQuestion {
  id: string;
  question: string;
  options: QuestionOption[];
  answer?: string | null;
  picked?: string | null;
  own?: string;
}

export interface QuestionCardProps {
  questions: AskedQuestion[];
  at?: number;
  sent?: boolean;
  headingLabel?: string;
  ownLabel?: string;
  ownPlaceholder?: string;
  skipLabel?: string;
  backLabel?: string;
  submitLabel?: string;
  sendingLabel?: string;
  dismissLabel?: string;
  onPick?: (id: string, option: string) => void;
  onOwn?: (id: string, text: string) => void;
  onAnswer?: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  onJump?: (at: number) => void;
  onDismiss?: () => void;
  class?: string;
}

export const OWN = " own";

export function answerable(question: AskedQuestion): boolean {
  return question.picked === OWN
    ? (question.own ?? "").trim().length > 0
    : (question.picked ?? null) !== null;
}

export function QuestionCard({
  questions,
  at = -1,
  sent,
  headingLabel,
  ownLabel = "Other",
  ownPlaceholder = "Type your own answer here",
  skipLabel = "Skip",
  backLabel = "Back",
  submitLabel = "Submit",
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
  const many = questions.length > 1;
  const open = questions[at];
  const settled = open === undefined;

  const take = (question: AskedQuestion, option: string) => {
    onPick?.(question.id, option);
    if (option === OWN) {
      window.setTimeout(() => field.current?.focus(), 0);
    }
  };

  return (
    <section
      class={cn("ui-question", className)}
      data-sent={sent || undefined}
      data-settled={settled || undefined}
      role="group"
      aria-label={many ? headingLabel : questions[0]?.question}
      onKeyDown={(event: JSX.TargetedKeyboardEvent<HTMLElement>) => {
        if (
          !open ||
          event.key < "1" ||
          event.key > "9" ||
          (event.target as HTMLElement).tagName === "INPUT"
        ) {
          return;
        }
        const row = [...open.options, { id: OWN, label: ownLabel }][Number(event.key) - 1];
        if (row) {
          event.preventDefault();
          take(open, row.id);
        }
      }}
    >
      {many ? (
        <div class="ui-question-head">
          <span class="ui-question-heading">{headingLabel}</span>
          {onDismiss && !settled ? (
            <button
              type="button"
              class="ui-question-dismiss"
              aria-label={dismissLabel}
              onClick={onDismiss}
            />
          ) : null}
        </div>
      ) : null}

      <ol class="ui-question-list">
        {questions.map((question, index) => {
          const here = index === at;
          const rows: QuestionOption[] = [...question.options, { id: OWN, label: ownLabel }];
          return (
            <li
              key={question.id}
              class="ui-question-item"
              data-here={here || undefined}
              data-done={question.answer ? "" : undefined}
            >
              <button
                type="button"
                class="ui-question-ask"
                aria-expanded={here}
                disabled={here || settled}
                onClick={() => onJump?.(index)}
              >
                {many ? <span class="ui-question-number">{index + 1}</span> : null}
                <span class="ui-question-text">
                  <span class="ui-question-title">{question.question}</span>
                  {question.answer ? (
                    <span class="ui-question-answer">{question.answer}</span>
                  ) : null}
                </span>
              </button>

              {here ? (
                <ul class="ui-question-rows">
                  {rows.map((row, slot) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        class="ui-question-row"
                        data-picked={question.picked === row.id || undefined}
                        aria-pressed={question.picked === row.id}
                        onClick={() => take(question, row.id)}
                      >
                        <span class="ui-question-row-text">
                          <span class="ui-question-row-label">{row.label}</span>
                          {row.hint ? <span class="ui-question-row-hint">{row.hint}</span> : null}
                        </span>
                        <span class="ui-question-row-key">{slot + 1}</span>
                      </button>
                      {row.id === OWN && question.picked === OWN ? (
                        <input
                          ref={field}
                          class="ui-question-own"
                          value={question.own ?? ""}
                          spellcheck={false}
                          aria-label={ownLabel}
                          placeholder={ownPlaceholder}
                          onInput={(event: JSX.TargetedEvent<HTMLInputElement>) =>
                            onOwn?.(question.id, event.currentTarget.value)
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
              ) : null}
            </li>
          );
        })}
      </ol>

      {settled ? null : (
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
            aria-disabled={!open || !answerable(open) || sent ? "true" : "false"}
            onClick={() => {
              if (!sent) {
                onAnswer?.();
              }
            }}
          >
            {sent ? sendingLabel : submitLabel}
          </button>
        </div>
      )}
    </section>
  );
}
