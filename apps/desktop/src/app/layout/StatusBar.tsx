import type { ComponentChildren } from "preact";

export function StatusBar({ children }: { children?: ComponentChildren }) {
  return (
    <div class="flex h-6 shrink-0 items-center justify-end gap-3 border-t border-border bg-surface px-2 text-faint">
      {children}
    </div>
  );
}
