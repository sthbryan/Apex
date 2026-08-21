import type { ComponentMeta } from "@/lib/meta";
import { Popover } from "@/organisms/popover/Popover";

export const popoverMeta: ComponentMeta = {
  name: "Popover",
  component: Popover,
  layer: "organism",
  description: "Anchored panel that closes on escape and outside pointer down.",
  variants: [
    { name: "bottom start", props: { open: true, title: "claude · usage" } },
    { name: "bottom end", props: { open: true, title: "claude · usage", align: "end" } },
    { name: "top center", props: { open: true, title: "claude · usage", side: "top", align: "center" } },
  ],
};
