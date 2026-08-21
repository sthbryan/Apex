import type { ComponentMeta } from "@/lib/meta";
import { Tooltip } from "@/molecules/tooltip/Tooltip";

export const tooltipMeta: ComponentMeta = {
  name: "Tooltip",
  component: Tooltip,
  layer: "molecule",
  description: "Hover and focus hint anchored to any of the four sides.",
  rule: "Name the control, never explain it. Explanations belong in a Field hint.",
  variants: [
    { name: "top", props: { content: "Sessions", side: "top" } },
    { name: "bottom", props: { content: "Sessions", side: "bottom" } },
    { name: "left", props: { content: "Sessions", side: "left" } },
    { name: "right", props: { content: "Sessions", side: "right" } },
  ],
};
