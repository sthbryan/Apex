import cn from "cnfast";
import { useEffect, useRef } from "preact/hooks";
import { SettingsRow } from "@/features/settings/SettingsRow";
import { closeSettings, settingsOpen } from "@/features/settings/state";
import { type Locale, locale, setLocale, t } from "@/shared/i18n";
import { setThemeMode, type ThemeMode, themeMode } from "@/shared/theme/mode";
import { Choice } from "@/shared/ui/Choice";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";
import { Segmented } from "@/shared/ui/Segmented";

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
  const overlay = usePresence<HTMLDivElement>(settingsOpen.value);

  useEffect(() => {
    if (!settingsOpen.value) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSettings();
      }
    };
    window.addEventListener("keydown", onEscape);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  if (!overlay.mounted) {
    return null;
  }

  const leaving = overlay.leaving;

  return (
    <div
      ref={overlay.holder}
      class={cn(`fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20`, {
        "animate-veil-out": leaving,
        "animate-veil-in": !leaving,
      })}
      onMouseDown={closeSettings}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-label={t("settings.title")}
        onMouseDown={(event) => event.stopPropagation()}
        class={cn(
          `w-120 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl outline-none`,
          {
            "animate-pop-out": leaving,
            "animate-pop-in": !leaving,
          },
        )}
      >
        <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span class="text-text">{t("settings.title")}</span>
          <button
            type="button"
            title={t("settings.close")}
            onClick={closeSettings}
            class="ml-auto flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
          >
            <Icon name="close" />
          </button>
        </header>

        <div class="px-4 py-1">
          <SettingsRow label={t("settings.theme")} hint={t("settings.themeHint")}>
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
          </SettingsRow>

          <SettingsRow label={t("settings.language")} hint={t("settings.languageHint")}>
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
          </SettingsRow>
        </div>

        <footer class="border-t border-border px-4 py-2 text-faint">
          {t("settings.agentsHint", { path: "~/.apex/agents" })}
        </footer>
      </div>
    </div>
  );
}
