import type { ComponentMeta } from "@/lib/meta";

export const switchMeta: ComponentMeta = {
  name: "Switch",
  layer: "atom",
  description: "Binary toggle with a required accessible label.",
  variants: [
    { name: "off", props: { checked: false, label: "Veil" } },
    { name: "on", props: { checked: true, label: "Veil" } },
    { name: "disabled", props: { checked: true, label: "Veil", disabled: true } },
    { name: "with label", props: { checked: true, label: "Veil", labelHidden: false } },
  ],
};
