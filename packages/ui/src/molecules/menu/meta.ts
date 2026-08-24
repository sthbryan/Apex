import type { ComponentMeta } from "@/lib/meta";
import { MenuItem } from "@/molecules/menu/Menu";

export const menuMeta: ComponentMeta = {
  name: "Menu",
  layer: "molecule",
  description: "The list a right click opens: the actions too rare to earn a button.",
  rule: "A header keeps what you reach for every minute. The menu takes the rest.",
  component: MenuItem,
  variants: [
    { name: "item", props: { hint: "⌘W" }, children: "Close the pane" },
    { name: "danger", props: { danger: true }, children: "Drop the worktree" },
    { name: "disabled", props: { disabled: true }, children: "Move to the sidebar" },
  ],
};
