import type { ComponentMeta } from "@/lib/meta";
import { DataRow } from "@/molecules/data-row/DataRow";

export const dataRowMeta: ComponentMeta = {
  name: "DataRow",
  component: DataRow,
  layer: "molecule",
  description: "Divider row for settings and facts: one name, one value.",
  rule: "Rows in a list share one divider, never a border each. Nothing here is clickable by itself.",
  variants: [
    { name: "fact", props: { label: "apexd", trail: "0.5.0" } },
    { name: "with sub", props: { label: "claude", sub: "2.0.14", trail: "native" } },
    { name: "dim", props: { label: "grok", sub: "0.4.0", trail: "terminal", dim: true } },
  ],
};
