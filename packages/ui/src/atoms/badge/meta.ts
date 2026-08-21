import type { ComponentMeta } from "@/lib/meta";

export const badgeMeta: ComponentMeta = {
  name: "Badge",
  layer: "atom",
  description: "Compact counter and git file marker.",
  variants: [
    { name: "accent", props: {}, children: "3" },
    { name: "neutral", props: { tone: "neutral" }, children: "12" },
    { name: "added", props: { tone: "added" }, children: "A" },
    { name: "removed", props: { tone: "removed" }, children: "D" },
    { name: "modified", props: { tone: "modified" }, children: "M" },
  ],
};
