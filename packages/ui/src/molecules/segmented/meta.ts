import type { ComponentMeta } from "@/lib/meta";
import { Segmented } from "@/molecules/segmented/Segmented";

const THEME = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const segmentedMeta: ComponentMeta = {
  name: "Segmented",
  component: Segmented,
  layer: "molecule",
  description: "Exclusive choice as a radiogroup, not a row of toggle buttons.",
  rule: "Two to four exclusive options that apply on click.",
  variants: [
    { name: "sm", props: { options: THEME, value: "dark", label: "Theme", size: "sm" } },
    { name: "md", props: { options: THEME, value: "dark", label: "Theme" } },
    { name: "lg", props: { options: THEME, value: "light", label: "Theme", size: "lg" } },
    {
      name: "with disabled",
      props: {
        options: [...THEME.slice(0, 2), { value: "dark", label: "Dark", disabled: true }],
        value: "system",
        label: "Theme",
      },
    },
  ],
};
