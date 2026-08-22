import type { ComponentMeta } from "@/lib/meta";
import { Spark } from "@/atoms/spark/Spark";

const CPU = [22, 26, 34, 30, 41, 38, 52, 44, 49, 61, 55, 68, 64, 72];

export const sparkMeta: ComponentMeta = {
  name: "Spark",
  component: Spark,
  layer: "atom",
  description: "Sparkline for a series that only needs a shape, not an axis.",
  rule: "Trend only. If the reader needs the number, pair it with a Readout.",
  variants: [
    { name: "working", props: { points: CPU, label: "CPU over the last minute" } },
    { name: "done", props: { points: CPU, tone: "done" } },
    { name: "failed", props: { points: CPU, tone: "failed" } },
    { name: "line only", props: { points: CPU, area: false, tone: "neutral" } },
    { name: "short", props: { points: [8, 12, 9, 14], height: 24, max: 100 } },
  ],
};
