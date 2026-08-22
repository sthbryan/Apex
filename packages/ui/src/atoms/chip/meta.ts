import type { ComponentMeta } from "@/lib/meta";
import { Chip } from "@/atoms/chip/Chip";

export const chipMeta: ComponentMeta = {
  name: "Chip",
  component: Chip,
  layer: "atom",
  description: "Monospace tag for branches, paths and formats.",
  rule: "Metadata in mono. Clickable only to jump somewhere; a chip that toggles is a ToggleChip.",
  variants: [
    { name: "branch", props: {}, children: "apex/claude" },
    { name: "format", props: {}, children: "PNG" },
    { name: "accent", props: { tone: "accent" }, children: "preview" },
    { name: "done", props: { tone: "done" }, children: ":5173" },
    { name: "blocked", props: { tone: "blocked" }, children: "stale" },
    { name: "button", props: { as: "button", tone: "done" }, children: ":5173" },
  ],
};
