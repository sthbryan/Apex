import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  open: boolean;
  children: ComponentChildren;
};

export function DockSlot({ open, children }: Props) {
  const panel = usePresence<HTMLDivElement>(open);

  if (!panel.mounted) {
    return null;
  }

  return (
    <div
      ref={panel.holder}
      class={cn(
        "flex w-(--apex-dock-width) shrink-0",
        panel.leaving ? "animate-push-out" : "animate-push-in",
      )}
    >
      {children}
    </div>
  );
}
