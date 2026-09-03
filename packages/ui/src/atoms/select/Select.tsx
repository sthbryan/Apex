import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { cn } from "@/lib/cn";
import { clippedRoom, opensLeftward, opensUpward } from "@/lib/place";

export interface SelectOption {
  value: string;
  label: ComponentChildren;
  keywords?: string;
}

export interface SelectProps {
  options: SelectOption[];
  label: string;
  value?: string;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  size?: "md" | "lg";
  class?: string;
}

export function Select({
  options,
  label,
  value,
  placeholder = "Select…",
  searchable,
  searchPlaceholder = "Search…",
  emptyLabel = "No matches",
  disabled,
  onChange,
  size,
  class: className,
}: SelectProps) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [left, setLeft] = useState(false);
  const [own, setOwn] = useState(options[0]?.value);
  const [query, setQuery] = useState("");
  const current = value ?? own;
  const selected = options.findIndex((o) => o.value === current);
  const filtered = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => {
      const wanted = query.trim().toLocaleLowerCase();
      if (!wanted) return true;
      const words = option.keywords ?? (typeof option.label === "string" ? option.label : "");
      return `${words} ${option.value}`.toLocaleLowerCase().includes(wanted);
    });
  const selectedInFiltered = filtered.findIndex(({ index }) => index === selected);
  const [active, setActive] = useState(selectedInFiltered < 0 ? 0 : selectedInFiltered);

  useEffect(() => {
    if (!open) return;
    (searchable ? search.current : list.current)?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, searchable]);

  const pick = (index: number) => {
    const option = filtered[index]?.option;
    if (!option) return;
    setOwn(option.value);
    setActive(index);
    setOpen(false);
    setQuery("");
    onChange?.(option.value);
    (root.current?.querySelector("button") as HTMLElement | null)?.focus();
  };

  const start = () => {
    if (disabled) return;
    setQuery("");
    setActive(selected < 0 ? 0 : selected);
    setUp(opensUpward(root.current, options.length, clippedRoom(root.current)));
    setLeft(opensLeftward(root.current));
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      (root.current?.querySelector("button") as HTMLElement | null)?.focus();
    } else if (event.key === "ArrowDown" && filtered.length > 0) {
      setActive((i) => (i + 1) % filtered.length);
    } else if (event.key === "ArrowUp" && filtered.length > 0) {
      setActive((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (event.key === "Home") {
      setActive(0);
    } else if (event.key === "End") {
      setActive(filtered.length - 1);
    } else if (
      event.key === "Enter" ||
      (event.key === " " && (event.target as HTMLElement).tagName !== "INPUT")
    ) {
      pick(active);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <span class={cn("ui-select", className)} data-size={size} ref={root}>
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
          data-up={up || undefined}
          data-left={left || undefined}
          onKeyDown={onKeyDown}
        >
          {searchable ? (
            <input
              ref={search}
              class="ui-select-search"
              type="search"
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={`${id}-options`}
              aria-activedescendant={filtered[active] ? `${id}-${filtered[active].index}` : undefined}
              onInput={(event) => {
                setQuery(event.currentTarget.value);
                setActive(0);
              }}
            />
          ) : null}
          <div
            id={`${id}-options`}
            class="ui-select-options"
            role="listbox"
            aria-label={label}
            aria-activedescendant={filtered[active] ? `${id}-${filtered[active].index}` : undefined}
            tabIndex={searchable ? -1 : 0}
            ref={list}
          >
          {filtered.map(({ option, index }, slot) => (
            <div
              key={option.value}
              id={`${id}-${index}`}
              class="ui-select-option"
              role="option"
              aria-selected={index === selected}
              data-active={slot === active || undefined}
              onPointerEnter={() => setActive(slot)}
              onClick={() => pick(slot)}
            >
              <span class="ui-select-option-label">{option.label}</span>
              {index === selected ? <span class="ui-select-check" aria-hidden="true" /> : null}
            </div>
          ))}
          {filtered.length === 0 ? <p class="ui-select-empty">{emptyLabel}</p> : null}
          </div>
        </div>
      ) : null}
    </span>
  );
}
