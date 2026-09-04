import type { VNode } from "preact";
import type { Frost, UiScale, VeilArea, WorkspaceStyle } from "@/features/settings/appearance";
import type { Locale } from "@/shared/i18n";
import type { ThemeMode } from "@/shared/theme/mode";
import type { IconName } from "@/shared/ui/Icon";

export const THEMES: { value: ThemeMode; icon: IconName }[] = [
  { value: "system", icon: "monitor" },
  { value: "light", icon: "sun" },
  { value: "dark", icon: "moon" },
];

export const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export const PANE_CAPS = [2, 3, 4, 5, 6, 8];

export const UI_SCALES: UiScale[] = ["compact", "normal", "roomy"];

export const WORKSPACE_STYLES: WorkspaceStyle[] = ["edge", "floating"];

export const WORKSPACE_STYLE_LABEL = {
  edge: "settings.workspaceStyleEdge",
  floating: "settings.workspaceStyleFloating",
} as const;

export const FROSTS: Frost[] = ["soft", "glare", "bright", "deep"];

export const VEIL_AREAS: VeilArea[] = ["window", "sidebar"];

export const VEIL_AREA_LABEL = {
  window: "settings.veilAreaWindow",
  sidebar: "settings.veilAreaSidebar",
} as const;

export const FROST_LABEL = {
  soft: "settings.frostSoft",
  glare: "settings.frostGlare",
  bright: "settings.frostBright",
  deep: "settings.frostDeep",
} as const;

export const UI_SCALE_LABEL = {
  compact: "settings.uiScaleCompact",
  normal: "settings.uiScaleNormal",
  roomy: "settings.uiScaleRoomy",
} as const;

export const IDLE_GRACE_NEVER = 4294967295;

export const IDLE_GRACES = [
  { value: 0, key: "settings.idleGrace0" },
  { value: 300, key: "settings.idleGrace300" },
  { value: 18000, key: "settings.idleGrace18000" },
  { value: IDLE_GRACE_NEVER, key: "settings.idleGraceNever" },
] as const;

export const THEME_HINT = {
  system: "settings.themeHint",
  light: "settings.themeHintLight",
  dark: "settings.themeHintDark",
} as const;

export type Entry = {
  id: string;
  label: string;
  hint: string;
  control: VNode;
};

export type Section = {
  id: string;
  label: string;
  sub: string;
  icon: IconName;
  entries: Entry[];
  panel?: VNode;
};
