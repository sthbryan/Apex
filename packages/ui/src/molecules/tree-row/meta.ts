import type { ComponentMeta } from "@/lib/meta";
import { TreeRow } from "@/molecules/tree-row/TreeRow";

export const treeRowMeta: ComponentMeta = {
  name: "TreeRow",
  layer: "molecule",
  description: "One node of a file tree, indented by depth.",
  rule: "Depth is a number, not padding. A leaf has no expanded prop.",
  component: TreeRow,
  variants: [
    { name: "folder open", props: { name: "apps/desktop", expanded: true } },
    { name: "folder closed", props: { name: "crates/apex-core", expanded: false } },
    { name: "nested", props: { name: "src/shared/theme", depth: 1, expanded: true } },
    { name: "modified leaf", props: { name: "tokens.css", depth: 2, status: "modified" } },
    { name: "added leaf", props: { name: "tree-row.css", depth: 2, status: "added" } },
    { name: "selected", props: { name: "theme.css", depth: 2, status: "modified", selected: true } },
  ],
};
