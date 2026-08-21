import type { ComponentMeta } from "@/lib/meta";
import { Kbd } from "@/atoms/kbd/Kbd";

export const kbdMeta: ComponentMeta = {
  name: "Kbd",
  component: Kbd,
  layer: "atom",
  description: "Keyboard key cap, single or grouped into a shortcut.",
  rule: "Show the shortcut where the action lives, never in a separate legend.",
  variants: [
    { name: "single", props: {}, children: "K" },
  ],
};
