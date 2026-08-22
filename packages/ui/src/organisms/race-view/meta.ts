import type { ComponentMeta } from "@/lib/meta";
import { RaceColumn } from "@/organisms/race-view/RaceView";

export const raceColumnMeta: ComponentMeta = {
  name: "RaceColumn",
  component: RaceColumn,
  layer: "organism",
  description: "One contender in a race, side by side with the others.",
  rule: "Columns stay in one order. A dropped contender dims but never disappears.",
  variants: [
    { name: "running", props: { name: "claude" }, children: "Still working…" },
    { name: "kept", props: { name: "claude", state: "kept" }, children: "14 files, tests 48 pass" },
    { name: "dropped", props: { name: "antigravity", state: "dropped" }, children: "Left nothing behind." },
  ],
};
