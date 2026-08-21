import type { ComponentMeta } from "../../lib/meta";

export const spinnerMeta: ComponentMeta = {
  name: "Spinner",
  layer: "atom",
  description: "Indeterminate activity indicator that inherits its colour.",
  variants: [
    { name: "sm", props: { size: "sm" } },
    { name: "md", props: { size: "md" } },
    { name: "lg", props: { size: "lg" } },
  ],
};
