import type { ComponentMeta } from "@/lib/meta";
import { Meter } from "@/molecules/meter/Meter";

export const meterMeta: ComponentMeta = {
  name: "Meter",
  component: Meter,
  layer: "molecule",
  description: "Labelled Bar with a trailing readout for usage and resources.",
  rule: "Label, bar and readout. Drop one and the number stops meaning anything.",
  variants: [
    { name: "usage", props: { label: "5h", value: 62, tick: 58 } },
    { name: "memory", props: { label: "RAM", value: 56, display: "18G" } },
    { name: "near limit", props: { label: "Quota", value: 91, tone: "failed" } },
  ],
};
