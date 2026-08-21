import type { ComponentMeta } from "../../lib/meta";

export const dotMeta: ComponentMeta = {
  name: "Dot",
  layer: "atom",
  description: "Status indicator for the five agent states.",
  variants: [
    { name: "idle", props: { state: "idle" } },
    { name: "working", props: { state: "working" } },
    { name: "blocked", props: { state: "blocked" } },
    { name: "done", props: { state: "done" } },
    { name: "failed", props: { state: "failed" } },
    { name: "sm", props: { state: "working", size: "sm" } },
    { name: "lg", props: { state: "working", size: "lg" } },
  ],
};
