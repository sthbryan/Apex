import type { ComponentMeta } from "@/lib/meta";
import { Slider } from "@/molecules/slider/Slider";

export const sliderMeta: ComponentMeta = {
  name: "Slider",
  layer: "molecule",
  description: "Range input with a monospace readout of its value.",
  rule: "Continuous values you can preview live. Anything discrete is a Segmented.",
  component: Slider,
  variants: [
    { name: "percent", props: { value: 76, label: "Transparency" } },
    { name: "pixels", props: { value: 26, max: 40, unit: "px", label: "Blur" } },
    { name: "disabled", props: { value: 40, label: "Blur", disabled: true } },
  ],
};
