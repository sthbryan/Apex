import type { ComponentMeta } from "@/lib/meta";
import { Composer } from "@/organisms/composer/Composer";

export const composerMeta: ComponentMeta = {
  name: "Composer",
  layer: "organism",
  description: "Prompt input with a slotted action bar underneath.",
  component: Composer,
  variants: [
    { name: "empty", props: { label: "Prompt", placeholder: "Ask, delegate, or start a task…", class: "w-64" } },
    { name: "single row", props: { label: "Reply", placeholder: "Reply to claude…", rows: 1, class: "w-64" } },
  ],
};
