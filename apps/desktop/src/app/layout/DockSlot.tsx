import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  open: boolean;
  overlay?: boolean;
  onHoverChange?: (hovering: boolean) => void;
  children: ComponentChildren;
};

export function DockSlot({ open, overlay = false, onHoverChange, children }: Props) {
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
          "pointer-events-none absolute inset-0 z-20 bg-black/25 transition-opacity duration-[var(--apex-dock)]",
          shownAsOverlay && !panel.leaving ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        class={cn(
          "h-full shrink-0 transition-[width] duration-[var(--apex-dock)] ease-[var(--apex-ease-out)]",
          takeSpace ? "w-(--apex-dock-width)" : "w-0",
        )}
      />
      <div
        ref={panel.holder}
        onMouseEnter={() => shownAsOverlay && onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
        class={cn(
          "absolute top-0 left-0 z-30 w-(--apex-dock-width) transition-[bottom] duration-[var(--apex-dock)] ease-[var(--apex-ease-out)]",
          shownAsOverlay ? "bottom-0" : "bottom-6",
          panel.leaving ? "animate-dock-out" : enterKind.current === "slide" && "animate-dock-in",
        )}
      >
        {children}
      </div>
    </>
  );
}
