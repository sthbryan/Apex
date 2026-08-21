import type { ComponentMeta } from "@/lib/meta";

export const meterMeta: ComponentMeta = {
  name: "Meter",
  layer: "molecule",
  description: "Labelled Bar with a trailing readout for usage and resources.",
  variants: [
    { name: "usage", props: { label: "5h", value: 62, tick: 58 } },
    { name: "memory", props: { label: "RAM", value: 56, display: "18G" } },
    { name: "near limit", props: { label: "Quota", value: 91, tone: "failed" } },
  ],
};
