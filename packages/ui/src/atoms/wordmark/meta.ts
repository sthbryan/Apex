import type { ComponentMeta } from "@/lib/meta";
import { Wordmark } from "@/atoms/wordmark/Wordmark";

export const wordmarkMeta: ComponentMeta = {
  name: "Wordmark",
  layer: "atom",
  description: "The product name set in the serif brand face.",
  rule: "The only place the serif appears. Every other string in the product is Inter or mono.",
  component: Wordmark,
  variants: [
    { name: "sm", props: { size: "sm" }, children: "APEX" },
    { name: "md", props: { size: "md" }, children: "APEX" },
    { name: "lg", props: { size: "lg" }, children: "APEX" },
    { name: "xl", props: { size: "xl" }, children: "APEX" },
  ],
};
