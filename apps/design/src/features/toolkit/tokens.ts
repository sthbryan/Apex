export interface TokenGroup {
  title: string;
  kind: "color" | "size";
  tokens: string[];
  note?: string;
}

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
    title: "Git",
    kind: "color",
    tokens: [
      "--apex-git-added",
      "--apex-git-removed",
      "--apex-git-modified",
      "--apex-git-dirty",
    ],
    note: "Aliases of the State tokens.",
  },
  {
    title: "Radii",
    kind: "size",
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
