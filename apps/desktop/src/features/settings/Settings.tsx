import { useEffect } from "preact/hooks";

import { closePage } from "@/app/view";
import { installedEditors, preferredEditor, setPreferredEditor } from "@/features/files/editors";
import { DockOrder } from "@/features/settings/DockOrder";
import { SettingsRow } from "@/features/settings/SettingsRow";
import { type Locale, locale, setLocale, t } from "@/shared/i18n";
import { setThemeMode, type ThemeMode, themeMode } from "@/shared/theme/mode";
import { Choice } from "@/shared/ui/Choice";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { Segmented } from "@/shared/ui/Segmented";
import { Select } from "@/shared/ui/Select";

const THEMES: { value: ThemeMode; icon: IconName }[] = [
  { value: "system", icon: "monitor" },
  { value: "light", icon: "sun" },
  { value: "dark", icon: "moon" },
];

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const THEME_HINT = {
  system: "settings.themeHint",
  light: "settings.themeHintLight",
  dark: "settings.themeHintDark",
} as const;

export function Settings() {
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
    <div class="flex h-full min-h-0 flex-col bg-bg" role="region" aria-label={t("settings.title")}>
      <header class="flex min-h-8.5 shrink-0 select-none items-center gap-2 border-b border-border bg-surface px-3">
        <Icon name="settings" size={14} class="shrink-0 text-faint" />
        <span class="truncate text-text">{t("settings.title")}</span>
        <button
          type="button"
          title={t("settings.close")}
          onClick={closePage}
          class="ml-auto flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
        >
          <Icon name="close" />
        </button>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto px-4">
        <SettingsRow label={t("settings.theme")} hint={t(THEME_HINT[themeMode.value])}>
          <Segmented label={t("settings.theme")}>
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

        <SettingsRow label={t("settings.editor")} hint={t("settings.editorHint")}>
          <Select
            label={t("settings.editor")}
            value={preferredEditor.value ?? ""}
            onSelect={(value) => setPreferredEditor(value === "" ? null : value)}
            options={[
              { value: "", label: t("settings.editorSystem") },
              ...installedEditors().map((editor) => ({
                value: editor.id,
                label: editor.name,
              })),
            ]}
          />
        </SettingsRow>

        <SettingsRow label={t("settings.sidebar")} hint={t("settings.sidebarHint")}>
          <DockOrder />
        </SettingsRow>

        <SettingsRow label={t("settings.language")} hint={t("settings.languageHint")}>
          <Segmented label={t("settings.language")}>
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

      <footer class="shrink-0 border-t border-border px-4 py-2 text-faint">
        {t("settings.agentsHint", { path: "~/.apex/agents" })}
      </footer>
    </div>
  );
}
