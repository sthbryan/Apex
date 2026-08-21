import type { ComponentMeta } from "@/lib/meta";
import { StatePill } from "@/molecules/state-pill/StatePill";

export const statePillMeta: ComponentMeta = {
  name: "StatePill",
  component: StatePill,
  layer: "molecule",
  description: "Agent state as a labelled pill: Dot plus text.",
  variants: [
    { name: "idle", props: { state: "idle" }, children: "Idle" },
    { name: "working", props: { state: "working" }, children: "Running" },
    { name: "blocked", props: { state: "blocked" }, children: "Waiting" },
    { name: "done", props: { state: "done" }, children: "Done" },
    { name: "failed", props: { state: "failed" }, children: "Failed" },
  ],
};
