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
  description: "Dropdown that opens a listbox you can drive with the keyboard.",
  rule: "Four options or more. Fewer than four is a Segmented.",
  component: Select,
  variants: [
    { name: "default", props: { options: EDITORS, label: "External editor" } },
    { name: "picked", props: { options: EDITORS, label: "External editor", value: "cursor" } },
    { name: "disabled", props: { options: EDITORS, label: "External editor", disabled: true } },
  ],
};
