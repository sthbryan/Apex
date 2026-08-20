import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { dockResizing } from "@/app/layout/state";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  open: boolean;
  overlay?: boolean;
  rail?: boolean;
  onHoverChange?: (hovering: boolean) => void;
  children: ComponentChildren;
};

export function DockSlot({ open, overlay = false, rail = false, onHoverChange, children }: Props) {
  const panel = usePresence<HTMLDivElement>(open);
  const overlayRef = useRef(overlay);
  const enterKind = useRef<"slide" | "none" | null>(open ? "none" : null);

  if (open) {
    overlayRef.current = overlay;
  }
  const shownAsOverlay = open ? overlay : overlayRef.current;

  if (!panel.mounted) {
    enterKind.current = null;
  } else if (enterKind.current === null) {
    enterKind.current = "slide";
  }

  useEffect(() => {
    if (!overlay) {
      onHoverChange?.(false);
    }
  }, [overlay, onHoverChange]);

  if (!panel.mounted) {
    return null;
  }

  const takeSpace = open && !shownAsOverlay;

  return (
    <>
      <div
        class={cn(
          "h-full shrink-0",
          !dockResizing.value && "transition-[width] duration-(--apex-dock) ease-(--apex-ease)",
          takeSpace ? (rail ? "w-(--apex-rail-width)" : "w-(--apex-dock-width)") : "w-0",
        )}
      />
      <div
        ref={panel.holder}
        onMouseEnter={() => shownAsOverlay && onHoverChange?.(true)}
        onMouseLeave={() => {
          if (!dockResizing.value) {
            onHoverChange?.(false);
          }
        }}
        class={cn(
          "absolute top-0 left-0 z-30 bottom-(--apex-statusbar-h)",
          rail ? "w-(--apex-rail-width)" : "w-(--apex-dock-width)",
          panel.leaving ? "animate-dock-out" : enterKind.current === "slide" && "animate-dock-in",
        )}
      >
        {children}
      </div>
    </>
  );
}
