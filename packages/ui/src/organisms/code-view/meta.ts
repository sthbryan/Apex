import type { ComponentMeta } from "@/lib/meta";
import { Code } from "@/organisms/code-view/CodeView";

export const codeViewMeta: ComponentMeta = {
  name: "CodeView",
  layer: "organism",
  description: "Gutter-numbered source listing with four syntax token roles.",
  component: Code,
  variants: [
    { name: "keyword", props: { token: "keyword" }, children: "const" },
    { name: "function", props: { token: "function" }, children: "clamp" },
    { name: "string", props: { token: "string" }, children: "\"passkey\"" },
    { name: "comment", props: { token: "comment" }, children: "# Apex" },
  ],
};
