import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type DiffLineKind = "add" | "del" | "ctx";

export interface DiffStatProps extends Omit<JSX.IntrinsicElements["span"], "ref"> {
  added?: number;
  removed?: number;
}

export function DiffStat({ added, removed, class: className, ...rest }: DiffStatProps) {
  return (
    <span class={cn("ui-diff-stat", className as string)} {...rest}>
      {added === undefined ? null : <span class="ui-diff-stat-add">+{added}</span>}
      {removed === undefined ? null : <span class="ui-diff-stat-del">−{removed}</span>}
    </span>
  );
}

export interface DiffViewProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  children?: ComponentChildren;
}

export function DiffView({ class: className, children, ...rest }: DiffViewProps) {
  return <div class={cn("ui-diff-view", className as string)} {...rest}>{children}</div>;
}

export interface DiffFileProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  path: string;
  added?: number;
  removed?: number;
  children?: ComponentChildren;
}

export function DiffFile({ path, added, removed, class: className, children, ...rest }: DiffFileProps) {
  return (
    <div class={cn("ui-diff-file", className as string)} {...rest}>
      <div class="ui-diff-head">
        <span class="ui-diff-path">{path}</span>
        <DiffStat added={added} removed={removed} />
      </div>
      {children}
    </div>
  );
}

export interface DiffHunkProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  range: string;
  actions?: ComponentChildren;
}

export function DiffHunk({ range, actions, class: className, ...rest }: DiffHunkProps) {
  return (
    <div class={cn("ui-diff-hunk", className as string)} {...rest}>
      {range}
      {actions ? <span class="ui-diff-hunk-actions">{actions}</span> : null}
    </div>
  );
}

export interface DiffLineProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  kind?: DiffLineKind;
  children?: ComponentChildren;
}

export function DiffLine({ kind = "ctx", class: className, children, ...rest }: DiffLineProps) {
  return (
    <div class={cn("ui-diff-line", className as string)} data-kind={kind} {...rest}>{children}</div>
  );
}
