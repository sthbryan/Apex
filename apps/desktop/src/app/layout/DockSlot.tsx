import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { dockResizing } from "@/app/layout/state";

type Props = {
  rail?: boolean;
  children: ComponentChildren;
};

export function DockSlot({ rail = false, children }: Props) {
  return (
    <div
      class={cn(
        "relative h-full shrink-0",
        !dockResizing.value && "transition-[width] duration-(--apex-dock) ease-(--apex-ease)",
        rail ? "w-(--apex-rail-width)" : "w-(--apex-dock-width)",
      )}
    >
      {children}
    </div>
  );
}
