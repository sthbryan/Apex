import type { ComponentMeta } from "@/lib/meta";
import { SettingsHeading } from "@/organisms/settings-dialog/SettingsDialog";

export const settingsDialogMeta: ComponentMeta = {
  name: "SettingsDialog",
  layer: "organism",
  description: "Modal with a section rail on the left and a scrolling body.",
  rule: "Group by what the user is changing, never by which subsystem owns it.",
  component: SettingsHeading,
  variants: [
    { name: "heading", props: { title: "Look" } },
    { name: "with sub", props: { title: "Look", sub: "How Apex feels on this machine." } },
  ],
};
