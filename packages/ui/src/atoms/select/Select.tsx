import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: ComponentChildren;
}

export interface SelectProps {
  options: SelectOption[];
  label: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  class?: string;
}

export function Select({
  options, label, value, placeholder = "Select…", disabled, onChange, class: className,
}: SelectProps) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState(options[0]?.value);
  const current = value ?? own;
  const selected = options.findIndex((o) => o.value === current);
  const [active, setActive] = useState(selected < 0 ? 0 : selected);

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const pick = (index: number) => {
    const option = options[index];
    if (!option) return;
    setOwn(option.value);
    setActive(index);
    setOpen(false);
    onChange?.(option.value);
    (root.current?.querySelector("button") as HTMLElement | null)?.focus();
  };

  const start = () => {
    if (disabled) return;
    setActive(selected < 0 ? 0 : selected);
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      (root.current?.querySelector("button") as HTMLElement | null)?.focus();
    } else if (event.key === "ArrowDown") {
      setActive((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (event.key === "Home") {
      setActive(0);
    } else if (event.key === "End") {
      setActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      pick(active);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <span class={cn("ui-select", className)} ref={root}>
      <button
        type="button"
        class="ui-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : start()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            start();
          }
        }}
      >
        <span class="ui-select-value">{options[selected]?.label ?? placeholder}</span>
        <span class="ui-select-caret" aria-hidden="true" />
      </button>
      {open ? (
        <div
          class="ui-select-list"
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          tabIndex={-1}
          ref={list}
          onKeyDown={onKeyDown}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-${index}`}
              class="ui-select-option"
              role="option"
              aria-selected={index === selected}
              data-active={index === active || undefined}
              onPointerEnter={() => setActive(index)}
              onClick={() => pick(index)}
            >
              <span class="ui-select-option-label">{option.label}</span>
              {index === selected ? <span class="ui-select-check" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </span>
  );
}
