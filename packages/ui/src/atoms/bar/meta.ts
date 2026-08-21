import type { ComponentMeta } from "../../lib/meta";

export const barMeta: ComponentMeta = {
  name: "Bar",
  layer: "atom",
  description: "Determinate progress track with an optional pace tick.",
  variants: [
    { name: "accent", props: { value: 62, label: "Usage" } },
    { name: "with tick", props: { value: 62, tick: 58, label: "Usage" } },
    { name: "done", props: { value: 100, tone: "done", label: "Complete" } },
    { name: "blocked", props: { value: 40, tone: "blocked", label: "Memory" } },
    { name: "failed", props: { value: 91, tone: "failed", label: "Quota" } },
  ],
};
