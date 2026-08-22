import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { cn } from "@/lib/cn";

export type ModalWidth = "sm" | "md" | "lg";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: ModalWidth;
  modal?: boolean;
  actions?: ComponentChildren;
  footer?: ComponentChildren;
  class?: string;
  children?: ComponentChildren;
}

export function Modal({ open, onClose, title, width = "md", modal = true, actions, footer, class: className, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) modal ? dialog.showModal() : dialog.show();
    if (!open && dialog.open) dialog.close();
  }, [open, modal]);

  return (
    <dialog
      ref={ref}
      class={cn("ui-modal", className)}
      data-width={width}
      data-modal={modal ? undefined : "false"}
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div class="ui-modal-head">
        <h2 class="ui-modal-title">{title}</h2>
        {actions}
      </div>
      <div class="ui-modal-body">{children}</div>
      {footer ? <div class="ui-modal-foot">{footer}</div> : null}
    </dialog>
  );
}
