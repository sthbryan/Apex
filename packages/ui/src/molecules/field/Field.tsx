import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export type FieldLayout = "inline" | "stacked";

export interface FieldProps {
  label: string;
  hint?: string;
  lead?: ComponentChildren;
  dim?: boolean;
  layout?: FieldLayout;
  htmlFor?: string;
  class?: string;
  children?: ComponentChildren;
}

export function Field({
  label, hint, lead, dim, layout = "inline", htmlFor, class: className, children,
}: FieldProps) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div class={cn("ui-field", className)} data-layout={layout} data-dim={dim || undefined}>
      {lead ? <span class="ui-field-lead">{lead}</span> : null}
      <div class="ui-field-text">
        <Label class="ui-field-label" for={htmlFor}>{label}</Label>
        {hint ? <span class="ui-field-hint">{hint}</span> : null}
      </div>
      <div class="ui-field-control">{children}</div>
    </div>
  );
}
