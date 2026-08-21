import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { cn } from "@/lib/cn";

export interface SettingsSection {
  id: string;
  label: string;
  icon?: ComponentChildren;
}

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  sections: SettingsSection[];
  section: string;
  onSection: (id: string) => void;
  title?: string;
  navTitle?: string;
  close?: ComponentChildren;
  class?: string;
  children?: ComponentChildren;
}

export function SettingsDialog({
  open,
  onClose,
  sections,
  section,
  onSection,
  title = "Settings",
  navTitle = "Settings",
  close,
  class: className,
  children,
}: SettingsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      class={cn("ui-modal ui-settings-dialog", className)}
      aria-label={title}
      onCancel={(e: Event) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {close ? <span class="ui-settings-close">{close}</span> : null}
      <nav class="ui-settings-nav" aria-label={navTitle}>
        <span class="ui-settings-nav-title">{navTitle}</span>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            class="ui-settings-nav-item"
            aria-selected={s.id === section}
            onClick={() => onSection(s.id)}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </nav>
      <div class="ui-settings-main">{children}</div>
    </dialog>
  );
}

export interface SettingsHeadingProps extends Omit<JSX.IntrinsicElements["div"], "title" | "ref"> {
  title: string;
  sub?: string;
}

export function SettingsHeading({ title, sub, class: className, ...rest }: SettingsHeadingProps) {
  return (
    <div class={className as string} {...rest}>
      <div class="ui-settings-title">{title}</div>
      {sub ? <div class="ui-settings-sub">{sub}</div> : null}
    </div>
  );
}
