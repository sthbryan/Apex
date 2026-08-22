import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export interface WelcomeProps {
  mark?: ComponentChildren;
  tagline?: ComponentChildren;
  suggestions?: ComponentChildren;
  class?: string;
  children?: ComponentChildren;
}

export function Welcome({ mark, tagline, suggestions, class: className, children }: WelcomeProps) {
  return (
    <div class={cn("ui-welcome", className)}>
      <div class="ui-welcome-inner">
        {mark || tagline ? (
          <div class="ui-welcome-mark">
            {mark}
            {tagline ? <p class="ui-welcome-tagline">{tagline}</p> : null}
          </div>
        ) : null}
        {children}
        {suggestions ? <div class="ui-welcome-suggestions">{suggestions}</div> : null}
      </div>
    </div>
  );
}
