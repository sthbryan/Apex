import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { dockMode } from "@/features/settings/state";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  open: boolean;
  children: ComponentChildren;
};

export function DockSlot({ open, children }: Props) {
  const floating = dockMode.value === "floating";
  const panel = usePresence<HTMLDivElement>(open);

  if (!panel.mounted) {
    return null;
  }

  if (floating) {
    return (
      <div class="pointer-events-none absolute inset-y-0 left-0 z-40 flex p-2">
        <div
          ref={panel.holder}
          class={cn(
            "pointer-events-auto flex",
            panel.leaving ? "animate-slide-out" : "animate-slide-in",
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panel.holder}
      class={cn(
        "flex w-(--apex-dock-width) shrink-0 overflow-hidden",
        panel.leaving ? "animate-push-out" : "animate-push-in",
      )}
    >
      {children}
    </div>
  );
}
