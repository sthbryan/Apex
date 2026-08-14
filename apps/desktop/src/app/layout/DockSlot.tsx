import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  open: boolean;
  overlay?: boolean;
  onHoverChange?: (hovering: boolean) => void;
  children: ComponentChildren;
};

export function DockSlot({ open, overlay = false, onHoverChange, children }: Props) {
  const panel = usePresence<HTMLDivElement>(open);

  if (!panel.mounted) {
    return null;
  }

  return (
    <div
      ref={panel.holder}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      class={cn(
        "w-(--apex-dock-width) shrink-0",
        overlay ? "absolute inset-y-0 left-0 z-30" : "flex",
        panel.leaving
          ? overlay
            ? "animate-slide-out"
            : "animate-push-out"
          : overlay
            ? "animate-slide-in"
            : "animate-push-in",
      )}
    >
      {children}
    </div>
  );
}
