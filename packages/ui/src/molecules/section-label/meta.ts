import type { ComponentMeta } from "@/lib/meta";
import { SectionLabel } from "@/molecules/section-label/SectionLabel";

export const sectionLabelMeta: ComponentMeta = {
  name: "SectionLabel",
  layer: "molecule",
  description: "Uppercase group heading with an optional count and an action slot.",
  rule: "Only when there are two or more groups. A single group needs no heading.",
  component: SectionLabel,
  variants: [
    { name: "plain", props: {}, children: "Worktrees" },
    { name: "with count", props: { count: 3 }, children: "Running" },
  ],
};
