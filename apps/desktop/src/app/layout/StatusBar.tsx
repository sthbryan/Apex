import type { ComponentChildren } from "preact";

type Props = {
  lead?: ComponentChildren;
  children?: ComponentChildren;
};

export function StatusBar({ lead, children }: Props) {
  return (
    <div class="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-bg px-2 text-faint">
      {lead}
      <div class="ml-auto flex items-center gap-3">{children}</div>
    </div>
  );
}
