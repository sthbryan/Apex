import type { ComponentMeta } from "@/lib/meta";
import { SidePanel } from "@/organisms/side-panel/SidePanel";

export const sidePanelMeta: ComponentMeta = {
  name: "SidePanel",
  layer: "organism",
  description: "Dockable column with optional head and foot regions.",
  component: SidePanel,
  variants: [
    { name: "left", props: { width: 160, class: "h-28" }, children: "Sessions" },
    { name: "right", props: { side: "right", width: 160, class: "h-28" }, children: "Inspector" },
  ],
};
