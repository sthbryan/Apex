import type { ComponentMeta } from "@/lib/meta";
import { Switch } from "@/atoms/switch/Switch";

export const switchMeta: ComponentMeta = {
  name: "Switch",
  component: Switch,
  layer: "atom",
  description: "Binary toggle with a required accessible label.",
  rule: "Applies immediately. If it needs a save button, it is a form field.",
  variants: [
    { name: "off", props: { checked: false, label: "Veil" } },
    { name: "on", props: { checked: true, label: "Veil" } },
    { name: "disabled", props: { checked: true, label: "Veil", disabled: true } },
    { name: "with label", props: { checked: true, label: "Veil", labelHidden: false } },
  ],
};
