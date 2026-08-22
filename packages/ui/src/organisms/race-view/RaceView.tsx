import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export interface RaceViewProps extends Omit<JSX.IntrinsicElements["section"], "ref"> {
  task?: ComponentChildren;
  actions?: ComponentChildren;
  foot?: ComponentChildren;
  children?: ComponentChildren;
}

export function RaceView({ task, actions, foot, class: className, children, ...rest }: RaceViewProps) {
  return (
    <section class={cn("ui-race", className as string)} {...rest}>
      {task || actions ? (
        <header class="ui-race-task">
          <span class="ui-race-task-name">{task}</span>
          {actions}
        </header>
      ) : null}
      <div class="ui-race-cols">{children}</div>
      {foot}
    </section>
  );
}

export type RaceState = "running" | "kept" | "dropped";

export interface RaceColumnProps {
  name: string;
  lead?: ComponentChildren;
  trail?: ComponentChildren;
  state?: RaceState;
  class?: string;
  children?: ComponentChildren;
}

export function RaceColumn({ name, lead, trail, state = "running", class: className, children }: RaceColumnProps) {
  return (
    <article class={cn("ui-race-col", className)} data-state={state} aria-label={name}>
      <header class="ui-race-col-head">
        {lead}
        <span class="ui-race-col-name">{name}</span>
        {trail}
      </header>
      <div class="ui-race-col-body">{children}</div>
    </article>
  );
}

export interface RaceDecisionProps {
  info?: ComponentChildren;
  actions?: ComponentChildren;
  class?: string;
}

export function RaceDecision({ info, actions, class: className }: RaceDecisionProps) {
  return (
    <footer class={cn("ui-race-decide", className)}>
      <span class="ui-race-decide-info">{info}</span>
      {actions}
    </footer>
  );
}
