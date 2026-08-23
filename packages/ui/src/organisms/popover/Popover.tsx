import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { cn } from "@/lib/cn";

export type PopoverSide = "top" | "bottom";
export type PopoverAlign = "start" | "center" | "end";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchor?: ComponentChildren;
  title?: ComponentChildren;
  meta?: ComponentChildren;
  actions?: ComponentChildren;
  side?: PopoverSide;
  align?: PopoverAlign;
  width?: number;
  block?: boolean;
  anchorClass?: string;
  label?: string;
  class?: string;
  children?: ComponentChildren;
}

export function Popover({
  open,
  onClose,
  anchor,
  title,
  meta,
  actions,
  side = "bottom",
  align = "start",
  width,
  block,
  anchorClass,
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
    <span class={cn("ui-popover-anchor", anchorClass)} data-block={block || undefined} ref={ref}>
      {anchor}
      {open ? (
        <div
          class={cn("ui-popover", className)}
          data-side={side}
          data-align={align}
          style={width ? { "--ui-popover-width": `${width}px` } : undefined}
          role="dialog"
          aria-label={label ?? (typeof title === "string" ? title : undefined)}
        >
          {title || meta || actions ? (
            <div class="ui-popover-head">
              {title}
              {meta ? <span class="ui-popover-meta">{meta}</span> : null}
              {actions ? <span class="ui-popover-actions">{actions}</span> : null}
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
    </span>
  );
}
