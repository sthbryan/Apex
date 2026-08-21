import type { ComponentMeta } from "@/lib/meta";
import { StatusPill } from "@/organisms/status-bar/StatusBar";

export const statusBarMeta: ComponentMeta = {
  name: "StatusBar",
  layer: "organism",
  description: "Bottom strip of compact status pills, with a right-aligned group.",
  rule: "Ambient state you may ignore. Nothing here is the only path to an action.",
  component: StatusPill,
  variants: [
    { name: "button", props: {}, children: "16 changed" },
    { name: "static", props: { interactive: false }, children: "main" },
    { name: "live", props: { live: true, interactive: false }, children: "2 racing" },
  ],
};
