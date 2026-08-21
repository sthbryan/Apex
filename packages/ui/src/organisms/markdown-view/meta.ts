import type { ComponentMeta } from "@/lib/meta";
import { MarkdownView } from "@/organisms/markdown-view/MarkdownView";

export const markdownViewMeta: ComponentMeta = {
  name: "MarkdownView",
  layer: "organism",
  description: "Prose container styling rendered markdown on the type scale.",
  rule: "Prose only. The moment it is interactive it stops being markdown.",
  component: MarkdownView,
  variants: [
    { name: "prose", props: { class: "w-56 !px-0 !py-0" }, children: "Run a team of AI agents." },
  ],
};
