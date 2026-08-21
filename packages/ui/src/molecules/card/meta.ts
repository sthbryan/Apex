import type { ComponentMeta } from "@/lib/meta";

export const cardMeta: ComponentMeta = {
  name: "Card",
  layer: "molecule",
  description: "Bordered Surface with an optional head row.",
  variants: [
    { name: "titled", props: { title: "Run a migration?" }, children: "Adds two columns to sessions." },
    { name: "body only", props: {}, children: "Every contender gets its own worktree." },
    { name: "floating", props: { title: "Codex finished", shadow: "lg", blur: true }, children: "exit 0" },
  ],
};
