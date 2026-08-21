import type { ComponentMeta } from "@/lib/meta";

export const kbdMeta: ComponentMeta = {
  name: "Kbd",
  layer: "atom",
  description: "Keyboard key cap, single or grouped into a shortcut.",
  variants: [
    { name: "single", props: {}, children: "K" },
  ],
};
