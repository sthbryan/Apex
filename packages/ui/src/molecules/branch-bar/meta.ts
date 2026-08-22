import type { ComponentMeta } from "@/lib/meta";
import { BranchBar } from "@/molecules/branch-bar/BranchBar";

export const branchBarMeta: ComponentMeta = {
  name: "BranchBar",
  layer: "molecule",
  description: "Which branch you are acting on, and how far it drifted.",
  rule: "Counts stay in git colours. A zero count is not rendered.",
  component: BranchBar,
  variants: [
    { name: "clean", props: { branch: "main", note: "synced 2m ago" } },
    { name: "ahead", props: { branch: "main", ahead: 2, note: "push pending" } },
    { name: "diverged", props: { branch: "apex/claude", ahead: 4, behind: 1 } },
    { name: "long name", props: { branch: "apex/antigravity/checkout-tests-rewrite", ahead: 12 } },
  ],
};
