import type { ComponentMeta } from "@/lib/meta";
import { DiffLine } from "@/organisms/diff-view/DiffView";

export const diffViewMeta: ComponentMeta = {
  name: "DiffView",
  layer: "organism",
  description: "Unified diff with file headers, hunks and add/remove lines.",
  rule: "Always show the file header. A hunk without a path is unreadable.",
  component: DiffLine,
  variants: [
    { name: "add", props: { kind: "add" }, children: "+ const next = clamp(x);" },
    { name: "del", props: { kind: "del" }, children: "- setWidth(x);" },
    { name: "ctx", props: { kind: "ctx" }, children: "  };" },
  ],
};
