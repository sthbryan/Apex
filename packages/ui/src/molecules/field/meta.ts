import type { ComponentMeta } from "@/lib/meta";
import { Field } from "@/molecules/field/Field";

export const fieldMeta: ComponentMeta = {
  name: "Field",
  component: Field,
  layer: "molecule",
  description: "Settings row pairing a label and optional hint with a control.",
  rule: "Label left, control right. Stack only when the control needs the full width.",
  variants: [
    { name: "inline", props: { label: "Theme" } },
    { name: "with hint", props: { label: "Veil", hint: "Translucent chrome over the desktop." } },
    { name: "stacked", props: { label: "Default agent", layout: "stacked" } },
  ],
};
