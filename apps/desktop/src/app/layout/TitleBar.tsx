import type { ComponentChildren } from "preact";

type Props = {
  padStart: string;
  lead?: ComponentChildren;
  children?: ComponentChildren;
};

export function TitleBar({ padStart, lead, children }: Props) {
  return (
    <header
      data-tauri-drag-region
      class="flex h-9 shrink-0 select-none items-center justify-between gap-3 bg-chrome"
      style={{
        paddingLeft: padStart,
        paddingRight: "max(var(--apex-controls-end, 0px), 12px)",
      }}
    >
      <div class="flex min-w-0 items-center gap-3">{lead}</div>
      <div class="flex items-center gap-3">{children}</div>
    </header>
  );
}
