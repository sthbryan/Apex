import type { ComponentChildren } from "preact";

type Props = {
  title: string;
  lead?: ComponentChildren;
  children?: ComponentChildren;
};

export function TitleBar({ title, lead, children }: Props) {
  return (
    <header
      data-tauri-drag-region
      class="flex h-9 shrink-0 select-none items-center justify-between gap-3 border-b border-border bg-surface"
      style={{
        paddingLeft: "max(var(--apex-controls-start, 0px), 12px)",
        paddingRight: "max(var(--apex-controls-end, 0px), 12px)",
      }}
    >
      <div class="flex min-w-0 items-center gap-3">
        <span data-tauri-drag-region class="shrink-0 font-semibold tracking-wide">
          {title}
        </span>
        {lead}
      </div>
      <div class="flex items-center gap-3">{children}</div>
    </header>
  );
}
