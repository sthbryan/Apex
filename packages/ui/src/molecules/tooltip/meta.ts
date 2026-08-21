import type { ComponentMeta } from "@/lib/meta";

export const tooltipMeta: ComponentMeta = {
  name: "Tooltip",
  layer: "molecule",
  description: "Hover and focus hint anchored to any of the four sides.",
  variants: [
    { name: "top", props: { content: "Sessions", side: "top" } },
    { name: "bottom", props: { content: "Sessions", side: "bottom" } },
    { name: "left", props: { content: "Sessions", side: "left" } },
    { name: "right", props: { content: "Sessions", side: "right" } },
  ],
};
