import type { ComponentMeta } from "@/lib/meta";
import { Tab } from "@/organisms/tab-bar/TabBar";

export const tabBarMeta: ComponentMeta = {
  name: "TabBar",
  layer: "organism",
  description: "Scrollable tab strip with a selected marker and an add button.",
  component: Tab,
  variants: [
    { name: "default", props: { title: "README.md" } },
    { name: "selected", props: { title: "Refactor auth middleware", selected: true } },
    { name: "long title", props: { title: "Rewrite the dock resize handler for retina displays" } },
  ],
};
