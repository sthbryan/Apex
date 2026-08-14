import type { ComponentChildren } from "preact";

import { locale, setLocale, t } from "../i18n";
import { cycleThemeMode, themeMode } from "../theme/mode";

const THEME_GLYPH: Record<string, string> = {
  system: "◐",
  light: "○",
  dark: "●",
};

type Props = {
  onNewSession: () => void;
  status: string;
};

export function Toolbar({ onNewSession, status }: Props) {
  return (
    <div class="flex items-center gap-1">
      <span class="mr-2 text-faint">{status}</span>

      <ToolbarButton label={t("toolbar.newSession")} onClick={onNewSession}>
        +
      </ToolbarButton>

      <ToolbarButton label={t(`toolbar.theme.${themeMode.value}`)} onClick={cycleThemeMode}>
        {THEME_GLYPH[themeMode.value]}
      </ToolbarButton>

      <ToolbarButton
        label={locale.value}
        onClick={() => setLocale(locale.value === "es" ? "en" : "es")}
      >
        <span class="uppercase">{locale.value}</span>
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ComponentChildren;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      class="flex size-6 items-center justify-center rounded text-faint hover:bg-raised hover:text-text"
    >
      {children}
    </button>
  );
}
