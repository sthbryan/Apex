import { CommandItem, CommandPalette } from "@apex/ui";
import { useEffect, useRef, useState } from "preact/hooks";
import { useOverlay } from "@/features/browser/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

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
  useOverlay(open);

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

  return (
    <CommandPalette
      open={open}
      onClose={() => (asking ? setAsking(null) : onClose())}
      viewport
      elRef={field}
      value={query}
      label={placeholder}
      placeholder={placeholder}
      onInput={(event) => onQuery(event.currentTarget.value)}
    >
      {items.length === 0 ? (
        <p class="px-2.5 py-2 text-faint">{t("palette.empty")}</p>
      ) : (
        items.map((item, index) =>
          item.remove && asking === item.id ? (
            <div key={item.id} class="flex items-center gap-2 rounded-sm bg-raised px-2.5 py-2">
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
            </div>
          ) : (
            <span key={item.id} class="group relative block">
              <CommandItem
                elRef={index === cursor ? selected : undefined}
                name={item.label}
                desc={item.hint}
                selected={index === cursor}
                title={item.hint ?? item.label}
                class={item.remove ? "pr-8" : undefined}
                onMouseEnter={() => setCursor(index)}
                onClick={item.run}
                trail={
                  <>
                    {item.badge && (
                      <span
                        class={
                          item.badge.alert
                            ? "shrink-0 tabular-nums text-state-blocked"
                            : "shrink-0 tabular-nums text-faint"
                        }
                      >
                        {item.badge.text}
                      </span>
                    )}
                    {item.preview && (
                      <span class="shrink-0 whitespace-pre rounded border border-border bg-black/20 px-1 py-0.5 font-mono text-2xs leading-tight text-faint">
                        {item.preview.join("\n")}
                      </span>
                    )}
                  </>
                }
              />
              {item.remove && (
                <button
                  type="button"
                  title={item.remove.label}
                  onClick={() => setAsking(item.id)}
                  class="absolute inset-y-0 right-1 hidden items-center px-1.5 text-faint transition-colors group-hover:flex hover:text-text"
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </span>
          ),
        )
      )}
    </CommandPalette>
  );
}
