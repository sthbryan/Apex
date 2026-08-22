import type { ComponentMeta } from "@/lib/meta";
import { Popover } from "@/organisms/popover/Popover";

export const popoverMeta: ComponentMeta = {
  name: "Popover",
  component: Popover,
  layer: "organism",
  description: "Panel anchored to its trigger, closing on escape and outside pointer down.",
  rule: "Anchored to what opened it. Never open a second popover inside one.",
  variants: [
    { name: "bottom start", props: { open: true, title: "claude · usage" } },
    { name: "bottom end", props: { open: true, title: "claude · usage", align: "end" } },
    { name: "top center", props: { open: true, title: "claude · usage", side: "top", align: "center" } },
    { name: "with meta", props: { open: true, title: "Resources", meta: "sampled every 5s", width: 300 } },
  ],
};
