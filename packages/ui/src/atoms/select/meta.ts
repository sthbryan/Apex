import type { ComponentMeta } from "@/lib/meta";
import { Select } from "@/atoms/select/Select";

const EDITORS = [
  { value: "system", label: "System default" },
  { value: "cursor", label: "Cursor" },
  { value: "vscode", label: "VS Code" },
];

export const selectMeta: ComponentMeta = {
  name: "Select",
  layer: "atom",
  description: "Native dropdown on the control tokens.",
  rule: "Four options or more. Fewer than four is a Segmented.",
  component: Select,
  variants: [
    { name: "default", props: { options: EDITORS, label: "External editor" } },
    { name: "disabled", props: { options: EDITORS, label: "External editor", disabled: true } },
  ],
};
