import cn from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";

import { t } from "@/shared/i18n";
import { usePresence } from "@/shared/ui/presence";

export type PickerItem = {
  id: string;
  label: string;
  hint?: string;
  preview?: string[];
  run: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  query: string;
  onQuery: (query: string) => void;
  placeholder: string;
  items: PickerItem[];
};

export function Picker({ open, onClose, query, onQuery, placeholder, items }: Props) {
  const [cursor, setCursor] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const selected = useRef<HTMLButtonElement>(null);
  const overlay = usePresence<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCursor(0);
    const claimFocus = () => field.current?.focus();
    claimFocus();
    const retry = requestAnimationFrame(claimFocus);
    return () => cancelAnimationFrame(retry);
  }, [open]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(items.length - 1, 0)));
  }, [items.length]);

  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((current) => (current + 1) % Math.max(items.length, 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((current) => (current - 1 + items.length) % Math.max(items.length, 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        items[cursor]?.run();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, items, cursor, onClose]);

  if (!overlay.mounted) {
    return null;
  }

  return (
    <div
      ref={overlay.holder}
      class={cn(
        "fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24",
        overlay.leaving ? "animate-veil-out" : "animate-veil-in",
      )}
      onMouseDown={onClose}
    >
      <div
        class={cn(
          "w-lg max-w-[90vw] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl",
          overlay.leaving ? "animate-pop-out" : "animate-pop-in",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={field}
          type="text"
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          value={query}
          placeholder={placeholder}
          onInput={(event) => onQuery(event.currentTarget.value)}
          class="w-full border-b border-border bg-transparent px-3 py-2.5 outline-none placeholder:text-faint"
        />
        <ul class="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <li class="px-3 py-2 text-faint">{t("palette.empty")}</li>
          ) : (
            items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  ref={index === cursor ? selected : undefined}
                  onMouseEnter={() => setCursor(index)}
                  onClick={item.run}
                  title={item.hint ?? item.label}
                  class={cn(
                    "flex w-full items-baseline gap-2 px-3 py-1.5 text-left transition-colors",
                    index === cursor ? "bg-raised text-text" : "text-muted",
                  )}
                >
                  <span class="shrink-0 truncate">{item.label}</span>
                  {item.hint && <span class="truncate text-faint">{item.hint}</span>}
                  {item.preview && (
                    <span class="ml-auto shrink-0 whitespace-pre rounded border border-border bg-black/20 px-1 py-0.5 font-mono text-[7px] leading-tigh text-faint">
                      {item.preview.join("\n")}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
