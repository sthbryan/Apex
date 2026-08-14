import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

import { Icon, type IconName } from "../components/Icon";
import { type Locale, locale, setLocale, t } from "../i18n";
import { type ThemeMode, setThemeMode, themeMode } from "../theme/mode";

export const settingsOpen = signal(false);

export function toggleSettings(): void {
  settingsOpen.value = !settingsOpen.value;
}

const THEMES: { value: ThemeMode; icon: IconName }[] = [
  { value: "system", icon: "monitor" },
  { value: "light", icon: "sun" },
  { value: "dark", icon: "moon" },
];

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export function Settings() {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen.value) {
      return;
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        settingsOpen.value = false;
      }
    };
    window.addEventListener("keydown", escape);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", escape);
  }, [settingsOpen.value]);

  if (!settingsOpen.value) {
    return null;
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20"
      onMouseDown={() => {
        settingsOpen.value = false;
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-label={t("settings.title")}
        onMouseDown={(event) => event.stopPropagation()}
        class="w-[30rem] max-w-[90vw] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl outline-none"
      >
        <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span class="text-text">{t("settings.title")}</span>
          <button
            type="button"
            title={t("settings.close")}
            onClick={() => {
              settingsOpen.value = false;
            }}
            class="ml-auto flex size-6 items-center justify-center rounded text-faint hover:bg-raised hover:text-text"
          >
            <Icon name="close" />
          </button>
        </header>

        <div class="px-4 py-1">
          <Row label={t("settings.theme")} hint={t("settings.themeHint")}>
            <Segmented>
              {THEMES.map((option) => (
                <Choice
                  key={option.value}
                  selected={themeMode.value === option.value}
                  onSelect={() => setThemeMode(option.value)}
                >
                  <Icon name={option.icon} />
                  {t(`theme.${option.value}`)}
                </Choice>
              ))}
            </Segmented>
          </Row>

          <Row label={t("settings.language")} hint={t("settings.languageHint")}>
            <Segmented>
              {LANGUAGES.map((option) => (
                <Choice
                  key={option.value}
                  selected={locale.value === option.value}
                  onSelect={() => setLocale(option.value)}
                >
                  {option.label}
                </Choice>
              ))}
            </Segmented>
          </Row>
        </div>

        <footer class="border-t border-border px-4 py-2 text-faint">
          {t("settings.agentsHint", { path: "~/.apex/agents" })}
        </footer>
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: preact.ComponentChildren;
}) {
  return (
    <div class="flex items-start gap-6 border-b border-border py-3.5 last:border-0">
      <div class="min-w-0 flex-1">
        <p class="text-text">{label}</p>
        <p class="mt-0.5 text-faint">{hint}</p>
      </div>
      <div class="shrink-0">{children}</div>
    </div>
  );
}

function Segmented({ children }: { children: preact.ComponentChildren }) {
  return (
    <div class="flex items-center gap-0.5 rounded-lg border border-border p-0.5">{children}</div>
  );
}

function Choice({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: preact.ComponentChildren;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      class={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
        selected ? "bg-raised text-text" : "text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
