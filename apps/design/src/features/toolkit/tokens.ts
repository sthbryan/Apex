export type TokenSwatch = "radius" | "height" | "bar" | "none";

export interface TokenGroup {
  title: string;
  kind: "color" | "size";
  tokens: string[];
  note?: string;
  swatch?: TokenSwatch;
}

export interface TokenAlias {
  token: string;
  target: string;
}

export const GIT_ALIASES: TokenAlias[] = [
  { token: "--apex-git-added", target: "--apex-state-done" },
  { token: "--apex-git-removed", target: "--apex-state-failed" },
  { token: "--apex-git-modified", target: "--apex-state-working" },
  { token: "--apex-git-dirty", target: "--apex-muted" },
  { token: "--apex-float", target: "--apex-overlay" },
];

export const SHADOWS = [
  "--apex-shadow-sm",
  "--apex-shadow-md",
  "--apex-shadow-lg",
  "--apex-shadow-xl",
];

export const Z_TOKENS = [
  "--apex-z-base",
  "--apex-z-raised",
  "--apex-z-sticky",
  "--apex-z-dock",
  "--apex-z-tooltip",
  "--apex-z-overlay",
  "--apex-z-modal",
  "--apex-z-toast",
  "--apex-z-palette",
];

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    title: "Surfaces",
    kind: "color",
    tokens: [
      "--apex-bg",
      "--apex-surface",
      "--apex-raised",
      "--apex-overlay",
      "--apex-tty",
      "--apex-border",
    ],
  },
  {
    title: "Content",
    kind: "color",
    tokens: [
      "--apex-text",
      "--apex-muted",
      "--apex-faint",
      "--apex-accent",
      "--apex-accent-fg",
      "--apex-focus",
    ],
  },
  {
    title: "State",
    kind: "color",
    tokens: [
      "--apex-state-idle",
      "--apex-state-working",
      "--apex-state-blocked",
      "--apex-state-done",
      "--apex-state-failed",
    ],
  },
  {
    title: "Radii",
    kind: "size",
    swatch: "radius",
    note: "Corner rounding. The swatch shows the actual curve at real size.",
    tokens: [
      "--apex-r-xs",
      "--apex-r-sm",
      "--apex-r-md",
      "--apex-r-lg",
      "--apex-r-xl",
      "--apex-r-full",
    ],
  },
  {
    title: "Control heights",
    kind: "size",
    swatch: "height",
    note: "Height of buttons, inputs and other interactive controls.",
    tokens: [
      "--apex-h-xs",
      "--apex-h-sm",
      "--apex-h-md",
      "--apex-h-lg",
      "--apex-h-xl",
    ],
  },
];

export const SIZE_EXTRA: TokenGroup[] = [
  {
    title: "Spacing",
    kind: "size",
    swatch: "bar",
    note: "Gaps and padding. The bar is the real width.",
    tokens: [
      "--apex-space-2xs",
      "--apex-space-xs",
      "--apex-space-sm",
      "--apex-space-md",
      "--apex-space-lg",
      "--apex-space-xl",
      "--apex-space-2xl",
      "--apex-space-3xl",
    ],
  },
  {
    title: "Layout",
    kind: "size",
    swatch: "none",
    note: "Fixed chrome dimensions the shell depends on.",
    tokens: [
      "--apex-rail-width",
      "--apex-dock-width",
      "--apex-title-bar-height",
    ],
  },
];

export const SIZE_GROUPS: TokenGroup[] = [
  ...TOKEN_GROUPS.filter((g) => g.kind === "size"),
  ...SIZE_EXTRA,
];

export const DURATIONS = [
  "--apex-instant",
  "--apex-quick",
  "--apex-swift",
  "--apex-slow",
];

export const EASINGS = [
  "--apex-ease",
  "--apex-ease-out",
  "--apex-ease-in",
  "--apex-ease-spring",
];

export const TYPE_TOKENS = [
  "--apex-text-2xs",
  "--apex-text-xs",
  "--apex-text-sm",
  "--apex-text-md",
  "--apex-text-lg",
  "--apex-text-xl",
  "--apex-text-2xl",
  "--apex-text-3xl",
  "--apex-text-4xl",
];

export const SAMPLES: Record<string, string> = {
  "--apex-text-4xl": "Run a team of AI agents",
  "--apex-text-3xl": "Race a task",
  "--apex-text-2xl": "Dock resize jank",
  "--apex-text-xl": "Refactor auth middleware",
  "--apex-text-lg": "Every contender gets its own worktree.",
  "--apex-text-md": "claude · 2.0.14 · shares context",
  "--apex-text-sm": "apex/claude · +382 −96",
  "--apex-text-xs": "14 files changed",
  "--apex-text-2xs": "exit 0",
};
