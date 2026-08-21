import type { ComponentMeta } from "@/lib/meta";

const THEME = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const segmentedMeta: ComponentMeta = {
  name: "Segmented",
  layer: "molecule",
  description: "Exclusive choice as a radiogroup, not a row of toggle buttons.",
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
