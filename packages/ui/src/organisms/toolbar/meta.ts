import type { ComponentMeta } from "@/lib/meta";

export const toolbarMeta: ComponentMeta = {
  name: "Toolbar",
  layer: "organism",
  description: "Header strip for panes and windows with lead, title and trailing slots.",
  variants: [
    { name: "surface", props: { title: "Auth middleware", label: "Pane" } },
    { name: "bg", props: { title: "Auth middleware", elevation: "bg", label: "Pane" } },
    { name: "borderless", props: { title: "Auth middleware", bordered: false, label: "Pane" } },
  ],
};
