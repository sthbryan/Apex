import type { ComponentMeta } from "@/lib/meta";

export const emptyStateMeta: ComponentMeta = {
  name: "EmptyState",
  layer: "organism",
  description: "Placeholder for empty panes, lists and search results.",
  variants: [
    { name: "no sessions", props: { title: "No sessions yet", detail: "Start a task and it will show up here." } },
    { name: "no results", props: { title: "Nothing matched" } },
  ],
};
