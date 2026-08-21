import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";
import type { AgentState } from "@/atoms/dot/Dot";
import { Tooltip } from "@/molecules/tooltip/Tooltip";

export type RailBadge = AgentState | "dirty";

export interface RailProps extends Omit<JSX.IntrinsicElements["nav"], "ref"> {
  children?: ComponentChildren;
}

export function Rail({ class: className, children, ...rest }: RailProps) {
  return <nav class={cn("ui-rail ui-chrome", className as string)} {...rest}>{children}</nav>;
}

export function RailSpacer() {
  return <span class="ui-rail-spacer" />;
}

export interface RailButtonProps extends Omit<JSX.IntrinsicElements["button"], "ref"> {
  label: string;
  current?: boolean;
  badge?: RailBadge;
  children?: ComponentChildren;
}

export function RailButton({ label, current, badge, class: className, children, ...rest }: RailButtonProps) {
  return (
    <Tooltip content={label} side="right">
      <button
        type="button"
        class={cn("ui-rail-button", className as string)}
        aria-current={current || undefined}
        aria-label={label}
        {...rest}
      >
        {children}
        {badge ? <span class="ui-rail-badge" data-state={badge} /> : null}
      </button>
    </Tooltip>
  );
}
