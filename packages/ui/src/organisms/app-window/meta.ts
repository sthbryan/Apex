import type { ComponentMeta } from "@/lib/meta";
import { AppWindow } from "@/organisms/app-window/AppWindow";

export const appWindowMeta: ComponentMeta = {
  name: "AppWindow",
  layer: "organism",
  description: "Rounded desktop window frame holding the whole shell.",
  rule: "One per window. Everything else lives inside it.",
  component: AppWindow,
  variants: [
    { name: "framed", props: { class: "h-24 w-56" } },
    { name: "flush", props: { flush: true, class: "h-24 w-56" } },
  ],
};
