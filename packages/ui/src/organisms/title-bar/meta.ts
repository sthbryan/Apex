import type { ComponentMeta } from "@/lib/meta";
import { TitleBar } from "@/organisms/title-bar/TitleBar";

export const titleBarMeta: ComponentMeta = {
  name: "TitleBar",
  layer: "organism",
  description: "Window header with traffic lights, centred title and action slot.",
  rule: "Window identity and window-level actions only.",
  component: TitleBar,
  variants: [
    { name: "with lights", props: { title: "APEX · apex-sandbox", class: "w-64" } },
    { name: "no lights", props: { title: "APEX · apex-sandbox", lights: false, class: "w-64" } },
  ],
};
