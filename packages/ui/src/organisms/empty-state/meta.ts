import type { ComponentMeta } from "@/lib/meta";
import { EmptyState } from "@/organisms/empty-state/EmptyState";

export const emptyStateMeta: ComponentMeta = {
  name: "EmptyState",
  component: EmptyState,
  layer: "organism",
  description: "Placeholder for empty panes, lists and search results.",
  rule: "Say what belongs here, then offer the action that fills it.",
  variants: [
    { name: "no sessions", props: { title: "No sessions yet", detail: "Start a task and it will show up here." } },
    { name: "no results", props: { title: "Nothing matched" } },
  ],
};
