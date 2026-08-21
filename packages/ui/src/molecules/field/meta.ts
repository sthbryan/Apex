import type { ComponentMeta } from "@/lib/meta";

export const fieldMeta: ComponentMeta = {
  name: "Field",
  layer: "molecule",
  description: "Settings row pairing a label and optional hint with a control.",
  variants: [
    { name: "inline", props: { label: "Theme" } },
    { name: "with hint", props: { label: "Veil", hint: "Translucent chrome over the desktop." } },
    { name: "stacked", props: { label: "Default agent", layout: "stacked" } },
  ],
};
