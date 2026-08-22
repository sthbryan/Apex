import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export type ReadoutTone = "neutral" | "accent" | "working" | "done" | "blocked" | "failed";

export interface ReadoutProps {
  value: ComponentChildren;
  note?: ComponentChildren;
  tone?: ReadoutTone;
  class?: string;
}

export function Readout({ value, note, tone = "neutral", class: className }: ReadoutProps) {
  return (
    <div class={cn("ui-readout", className)} data-tone={tone}>
      <span class="ui-readout-value">{value}</span>
      {note ? <span class="ui-readout-note">{note}</span> : null}
    </div>
  );
}
