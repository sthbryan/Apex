import type { ComponentChildren, JSX, Ref } from "preact";
import { useEffect, useState } from "preact/hooks";
import { cn } from "@/lib/cn";
import { Spinner } from "@/atoms/spinner/Spinner";

export interface TranscriptProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  elRef?: Ref<HTMLDivElement>;
  children?: ComponentChildren;
}

export function Transcript({ elRef, class: className, children, ...rest }: TranscriptProps) {
  return (
    <div class={cn("ui-transcript", className as string)} ref={elRef} {...rest}>
      {children}
    </div>
  );
}

export type MessageFrom = "user" | "agent";

export interface MessageProps {
  from?: MessageFrom;
  lead?: ComponentChildren;
  meta?: ComponentChildren;
  class?: string;
  children?: ComponentChildren;
}

export function Message({ from = "agent", lead, meta, class: className, children }: MessageProps) {
  return (
    <div class={cn("ui-message", className)} data-from={from}>
      {lead || meta ? (
        <div class="ui-message-head">
          {lead}
          {meta ? <span class="ui-message-meta">{meta}</span> : null}
        </div>
      ) : null}
      <div class="ui-message-body">{children}</div>
    </div>
  );
}

export type ToolStatus = "pending" | "running" | "ok" | "failed";

export interface ToolCallProps {
  command: string;
  name?: string;
  status?: ToolStatus;
  detail?: string;
  open?: boolean;
  onToggle?: () => void;
  class?: string;
  children?: ComponentChildren;
}

const GLYPH: Record<Exclude<ToolStatus, "running">, string> = { pending: "○", ok: "✓", failed: "✗" };

export function ToolCall({
  command,
  name,
  status = "ok",
  detail,
  open,
  onToggle,
  class: className,
  children,
}: ToolCallProps) {
  const Head = (onToggle ? "button" : "div") as "button";
  const [ever, setEver] = useState(Boolean(open));

  useEffect(() => {
    if (open) {
      setEver(true);
    }
  }, [open]);

  return (
    <section class={cn("ui-tool-call", className)} data-status={status} data-open={open || undefined}>
      <Head
        type={onToggle ? "button" : undefined}
        class="ui-tool-call-head"
        onClick={onToggle}
        aria-expanded={onToggle ? Boolean(open) : undefined}
      >
        {onToggle ? <span class="ui-tool-call-chevron" aria-hidden="true" /> : null}
        {name ? <span class="ui-tool-call-name">{name}</span> : null}
        <span class="ui-tool-call-command">{command}</span>
        <span class="ui-tool-call-status">
          {status === "running" ? <Spinner size="sm" label="Running" /> : GLYPH[status]}
          {detail ? <span class="ui-tool-call-detail">{detail}</span> : null}
        </span>
      </Head>
      {ever && children ? (
        <div class="ui-tool-call-fold">
          <div class="ui-tool-call-output">{children}</div>
        </div>
      ) : null}
    </section>
  );
}
