import type { ComponentMeta } from "@/lib/meta";
import { Chip } from "@/atoms/chip/Chip";

export const chipMeta: ComponentMeta = {
  name: "Chip",
  component: Chip,
  layer: "atom",
  description: "Monospace tag for branches, paths and formats.",
  variants: [
    { name: "branch", props: {}, children: "apex/claude" },
    { name: "format", props: {}, children: "PNG" },
  ],
};
