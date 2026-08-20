import cn from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";
import { useOverlay } from "@/features/browser/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";

export type PickerRemove = {
  label: string;
  ask: string;
  yes: string;
  no: string;
  run: () => void;
};

export type PickerItem = {
  id: string;
  label: string;
  hint?: string;
  badge?: { text: string; alert: boolean };
  preview?: string[];
  remove?: PickerRemove;
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
  const [asking, setAsking] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const selected = useRef<HTMLButtonElement>(null);
  const overlay = usePresence<HTMLDivElement>(open);
  useOverlay(overlay.mounted);

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
    setAsking(null);
  }, [query, open]);

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
        if (asking) {
          setAsking(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, items, cursor, onClose, asking]);

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
          "w-lg max-w-[90vw] overflow-hidden rounded-lg border border-border bg-float shadow-2xl",
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
            items.map((item, index) =>
              item.remove && asking === item.id ? (
                <li key={item.id} class="flex items-center gap-2 bg-raised px-3 py-1.5">
                  <span class="min-w-0 flex-1 truncate text-muted">{item.remove.ask}</span>
                  <button
                    type="button"
                    onClick={item.remove.run}
                    class="shrink-0 text-state-failed transition-colors hover:underline"
                  >
                    {item.remove.yes}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAsking(null)}
                    class="shrink-0 text-faint transition-colors hover:text-text"
                  >
                    {item.remove.no}
                  </button>
                </li>
              ) : (
                <li key={item.id} class="group relative">
                  <button
                    type="button"
                    ref={index === cursor ? selected : undefined}
                    onMouseEnter={() => setCursor(index)}
                    onClick={item.run}
                    title={item.hint ?? item.label}
                    class={cn(
                      "relative flex w-full items-baseline gap-2 px-3 py-1.5 text-left transition-colors",
                      index === cursor ? "bg-raised text-text" : "text-muted",
                      item.remove && "pr-8",
                    )}
                  >
                    {index === cursor && (
                      <span
                        aria-hidden="true"
                        class="pointer-events-none absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent"
                      />
                    )}
                    <span class="shrink-0 truncate">{item.label}</span>
                    {item.hint && <span class="truncate text-faint">{item.hint}</span>}
                    {item.badge && (
                      <span
                        class={cn(
                          "ml-auto shrink-0 text-micro tabular-nums",
                          item.badge.alert ? "text-state-blocked" : "text-faint",
                        )}
                      >
                        {item.badge.text}
                      </span>
                    )}
                    {item.preview && (
                      <span class="ml-auto shrink-0 whitespace-pre rounded border border-border bg-black/20 px-1 py-0.5 font-mono text-petite leading-tight text-faint">
                        {item.preview.join("\n")}
                      </span>
                    )}
                  </button>
                  {item.remove && (
                    <button
                      type="button"
                      title={item.remove.label}
                      onClick={() => setAsking(item.id)}
                      class="absolute inset-y-0 right-1 hidden items-center px-1.5 text-faint transition-colors hover:text-text group-hover:flex"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </li>
              ),
            )
          )}
        </ul>
      </div>
    </div>
  );
}
