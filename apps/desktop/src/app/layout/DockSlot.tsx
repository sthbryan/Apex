import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  open: boolean;
  onMountedChange: (mounted: boolean) => void;
  children: ComponentChildren;
};

export function DockSlot({ open, onMountedChange, children }: Props) {
  const panel = usePresence<HTMLDivElement>(open);

  useEffect(() => {
    onMountedChange(panel.mounted);
  }, [panel.mounted, onMountedChange]);

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
