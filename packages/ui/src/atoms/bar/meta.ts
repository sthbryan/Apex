import type { ComponentMeta } from "@/lib/meta";
import { Bar } from "@/atoms/bar/Bar";

export const barMeta: ComponentMeta = {
  name: "Bar",
  component: Bar,
  layer: "atom",
  description: "Determinate progress track with an optional pace tick.",
  rule: "Always pair it with a number. A bar on its own is decoration.",
  variants: [
    { name: "accent", props: { value: 62, label: "Usage" } },
    { name: "with tick", props: { value: 62, tick: 58, label: "Usage" } },
    { name: "done", props: { value: 100, tone: "done", label: "Complete" } },
    { name: "blocked", props: { value: 40, tone: "blocked", label: "Memory" } },
    { name: "failed", props: { value: 91, tone: "failed", label: "Quota" } },
  ],
};
