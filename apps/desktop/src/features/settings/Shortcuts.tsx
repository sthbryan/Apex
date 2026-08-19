import cn from "cnfast";
import { useEffect, useState } from "preact/hooks";
import { SHORTCUTS, type Shortcut } from "@/app/keymap";
import { closePage } from "@/app/view";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const GROUPS: Shortcut["group"][] = ["navigation", "panes"];

function Keycap({ value }: { value: string }) {
  return (
    <kbd class="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border bg-raised px-1.5 font-mono text-micro font-medium leading-none text-text shadow-[0_1px_0_0_var(--color-border)]">
      {value}
    </kbd>
  );
}

function KeycapRow({ keys }: { keys: string }) {
  return (
    <span class="flex shrink-0 items-center gap-1">
      {keys.split(" + ").map((part) => (
        <Keycap key={part} value={part} />
      ))}
    </span>
  );
}

export function Shortcuts() {
  const [group, setGroup] = useState<Shortcut["group"]>("navigation");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePage();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? SHORTCUTS.filter((shortcut) =>
        `${t(shortcut.label)} ${shortcut.keys}`.toLowerCase().includes(needle),
      )
    : SHORTCUTS.filter((shortcut) => shortcut.group === group);

  return (
    <div class="flex h-full min-h-0 flex-col bg-bg" role="region" aria-label={t("shortcuts.title")}>
      <header class="flex min-h-8.5 shrink-0 select-none items-center gap-2 border-b border-border bg-surface px-3">
        <Icon name="keyboard" size={14} class="shrink-0 text-faint" />
        <span class="truncate text-text">{t("shortcuts.title")}</span>
        <button
          type="button"
          title={t("shortcuts.close")}
          onClick={closePage}
          class="ml-auto flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
        >
          <Icon name="close" />
        </button>
      </header>

      <div class="flex min-h-0 flex-1">
        <nav class="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border p-2">
          <input
            type="search"
            value={query}
            placeholder={t("shortcuts.search")}
            autocomplete="off"
            spellcheck={false}
            onInput={(event) => setQuery(event.currentTarget.value)}
            class="mb-1 rounded border border-border bg-overlay px-2 py-1 text-text outline-none placeholder:text-faint focus:border-muted"
          />
          {GROUPS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setQuery("");
                setGroup(option);
              }}
              class={cn(
                "rounded px-2 py-1 text-left transition-colors",
                !needle && option === group
                  ? "bg-raised text-text"
                  : "text-muted hover:bg-raised hover:text-text",
              )}
            >
              {t(`shortcuts.groups.${option}` as const)}
            </button>
          ))}
        </nav>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-3">
          <div class="mx-auto w-full max-w-5xl">
            {shown.length === 0 && <p class="text-faint">{t("shortcuts.noMatch")}</p>}
            {GROUPS.map((option) => {
              const rows = shown.filter((shortcut) => shortcut.group === option);
              if (rows.length === 0) {
                return null;
              }
              return (
                <section key={option}>
                  {needle && (
                    <h3 class="pt-3 pb-1 text-micro uppercase tracking-wider text-faint first:pt-0">
                      {t(`shortcuts.groups.${option}` as const)}
                    </h3>
                  )}
                  {rows.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      class="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-0"
                    >
                      <span class="min-w-0 truncate text-text">{t(shortcut.label)}</span>
                      <KeycapRow keys={shortcut.keys} />
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
