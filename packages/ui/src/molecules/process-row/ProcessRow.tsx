import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export interface ProcessRowProps {
  command: string;
  pid?: number | string;
  mem?: string;
  actions?: ComponentChildren;
  class?: string;
}

export function ProcessRow({ command, pid, mem, actions, class: className }: ProcessRowProps) {
  return (
    <div class={cn("ui-process-row", className)}>
      <span class="ui-process-row-command">{command}</span>
      {pid === undefined ? null : <span class="ui-process-row-pid">{pid}</span>}
      {mem ? <span class="ui-process-row-mem">{mem}</span> : null}
      {actions ? <span class="ui-process-row-actions">{actions}</span> : null}
    </div>
  );
}
