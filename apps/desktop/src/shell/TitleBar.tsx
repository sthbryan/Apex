import type { ComponentChildren } from "preact";

type Props = {
  title: string;
  children?: ComponentChildren;
};

export function TitleBar({ title, children }: Props) {
  return (
    <header
      data-tauri-drag-region
      class="flex h-9 shrink-0 select-none items-center justify-between gap-3 border-b border-border bg-surface"
      style={{
        paddingLeft: "max(var(--apex-controls-start, 0px), 12px)",
        paddingRight: "max(var(--apex-controls-end, 0px), 12px)",
      }}
    >
      <span data-tauri-drag-region class="font-semibold tracking-wide">
        {title}
      </span>
      <div class="flex items-center gap-3">{children}</div>
    </header>
  );
}
