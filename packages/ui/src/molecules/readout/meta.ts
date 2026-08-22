import type { ComponentMeta } from "@/lib/meta";
import { Readout } from "@/molecules/readout/Readout";

export const readoutMeta: ComponentMeta = {
  name: "Readout",
  component: Readout,
  layer: "molecule",
  description: "One number worth reading from across the room, with the context that dates it.",
  rule: "One readout per panel. The note says when the number stops being true.",
  variants: [
    { name: "neutral", props: { value: "62%", note: "resets in 2h 30m · Tue 4:00" } },
    { name: "done", props: { value: "12%", tone: "done", note: "plenty left" } },
    { name: "blocked", props: { value: "71%", tone: "blocked", note: "over pace" } },
    { name: "failed", props: { value: "94%", tone: "failed", note: "throttled" } },
    { name: "bare", props: { value: "18.2 GB" } },
  ],
};
