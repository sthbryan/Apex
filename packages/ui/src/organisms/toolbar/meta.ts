import type { ComponentMeta } from "@/lib/meta";
import { Toolbar } from "@/organisms/toolbar/Toolbar";

export const toolbarMeta: ComponentMeta = {
  name: "Toolbar",
  component: Toolbar,
  layer: "organism",
  description: "Header strip for panes and windows with lead, title and trailing slots.",
  rule: "Actions scoped to the pane directly below it.",
  variants: [
    { name: "surface", props: { title: "Auth middleware", label: "Pane" } },
    { name: "bg", props: { title: "Auth middleware", elevation: "bg", label: "Pane" } },
    { name: "borderless", props: { title: "Auth middleware", bordered: false, label: "Pane" } },
  ],
};
