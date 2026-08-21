import type { ComponentMeta } from "@/lib/meta";
import { Markdown } from "@/organisms/markdown/Markdown";

export const markdownMeta: ComponentMeta = {
  name: "Markdown",
  layer: "organism",
  description: "Prose container styling rendered markdown on the type scale.",
  rule: "Prose only. The moment it is interactive it stops being markdown.",
  component: Markdown,
  variants: [
    { name: "prose", props: { class: "w-56 !px-0 !py-0" }, children: "Run a team of AI agents." },
  ],
};
