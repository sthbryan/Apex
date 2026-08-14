import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { dockMode } from "@/features/settings/state";
import { usePresence } from "@/shared/ui/presence";

type Props = {
  open: boolean;
  onDismiss: () => void;
  children: ComponentChildren;
};

export function DockSlot({ open, onDismiss, children }: Props) {
  const floating = dockMode.value === "floating";
  const panel = usePresence<HTMLDivElement>(open && floating);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !floating) {
      return;
    }
    const dismiss = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) {
        onDismiss();
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open, floating, onDismiss]);

  if (!floating) {
    return open ? <>{children}</> : null;
  }

  if (!panel.mounted) {
    return null;
  }

  return (
    <div ref={holder} class="absolute inset-y-0 left-0 z-40 flex">
      <div
        ref={panel.holder}
        class={cn("flex shadow-2xl", panel.leaving ? "animate-slide-out" : "animate-slide-in")}
      >
        {children}
      </div>
    </div>
  );
}
