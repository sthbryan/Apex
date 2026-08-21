import type { ComponentMeta } from "@/lib/meta";
import { Pane } from "@/organisms/pane/Pane";

export const paneMeta: ComponentMeta = {
  name: "Pane",
  layer: "organism",
  description: "Content region with a header, scrolling body and optional footer.",
  component: Pane,
  variants: [
    { name: "titled", props: { title: "Auth middleware", class: "h-24 w-56 border border-border rounded-md overflow-hidden" }, children: "Transcript" },
    { name: "with sub", props: { title: "Auth middleware", sub: "apex/claude · 2m 14s", class: "h-24 w-56 border border-border rounded-md overflow-hidden" }, children: "Transcript" },
    { name: "headless", props: { class: "h-24 w-56 border border-border rounded-md overflow-hidden" }, children: "Just a body" },
  ],
};
