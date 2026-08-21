import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { cn } from "@/lib/cn";

export type PopoverSide = "top" | "bottom";
export type PopoverAlign = "start" | "center" | "end";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: ComponentChildren;
  title?: string;
  side?: PopoverSide;
  align?: PopoverAlign;
  label?: string;
  class?: string;
  children?: ComponentChildren;
}

export function Popover({
  open,
  onClose,
  anchor,
  title,
  side = "bottom",
  align = "start",
  label,
  class: className,
  children,
}: PopoverProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <span class="ui-popover-anchor" ref={ref}>
      {anchor}
      {open ? (
        <div
          class={cn("ui-popover", className)}
          data-side={side}
          data-align={align}
          role="dialog"
          aria-label={label ?? title}
        >
          {title ? <div class="ui-popover-head">{title}</div> : null}
          {children}
        </div>
      ) : null}
    </span>
  );
}
