import { useEffect } from "preact/hooks";
import { SHORTCUTS, type Shortcut } from "@/app/keymap";
import { closePage } from "@/app/view";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const GROUPS: Shortcut["group"][] = ["navigation", "panes"];

function Keycap({ value }: { value: string }) {
  return (
    <kbd class="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border bg-raised px-1.5 font-mono text-[11px] font-medium leading-none text-text shadow-[0_1px_0_0_var(--color-border)]">
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

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {GROUPS.map((group, index) => (
          <div key={group} class={index > 0 ? "pt-4" : ""}>
            <p class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {t(`shortcuts.groups.${group}` as const)}
            </p>
            {SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
              <div
                key={shortcut.id}
                class="flex items-center justify-between gap-4 border-b border-border px-3 py-2.5 last:border-0"
              >
                <span class="min-w-0 truncate text-[13px] text-text">{t(shortcut.label)}</span>
                <KeycapRow keys={shortcut.keys} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
