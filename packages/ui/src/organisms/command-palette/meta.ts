import type { ComponentMeta } from "@/lib/meta";
import { CommandItem } from "@/organisms/command-palette/CommandPalette";

export const commandPaletteMeta: ComponentMeta = {
  name: "CommandPalette",
  layer: "organism",
  description: "Search-driven command list with keyboard selection.",
  component: CommandItem,
  variants: [
    { name: "default", props: { name: "New session" } },
    { name: "selected", props: { name: "New session", desc: "In a new tab", selected: true } },
    { name: "with desc", props: { name: "Race a task", desc: "Fan one task across agents" } },
  ],
};
