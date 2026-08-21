import type { ComponentMeta } from "@/lib/meta";
import { Badge } from "@/atoms/badge/Badge";

export const badgeMeta: ComponentMeta = {
  name: "Badge",
  component: Badge,
  layer: "atom",
  description: "Compact counter and git file marker.",
  rule: "Counts and file markers only. If it needs a verb, it is a Pill.",
  variants: [
    { name: "accent", props: {}, children: "3" },
    { name: "neutral", props: { tone: "neutral" }, children: "12" },
    { name: "added", props: { tone: "added" }, children: "A" },
    { name: "removed", props: { tone: "removed" }, children: "D" },
    { name: "modified", props: { tone: "modified" }, children: "M" },
  ],
};
