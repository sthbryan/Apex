import type { ComponentMeta } from "@/lib/meta";
import { Checkbox } from "@/atoms/checkbox/Checkbox";

export const checkboxMeta: ComponentMeta = {
  name: "Checkbox",
  layer: "atom",
  description: "Square toggle for staging and multi-select lists.",
  component: Checkbox,
  variants: [
    { name: "off", props: { checked: false, label: "Stage file" } },
    { name: "on", props: { checked: true, label: "Stage file" } },
    { name: "disabled", props: { checked: true, label: "Stage file", disabled: true } },
  ],
};
