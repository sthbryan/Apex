import type { ComponentMeta } from "@/lib/meta";

export const pillMeta: ComponentMeta = {
  name: "Pill",
  layer: "atom",
  description: "Rounded label for capabilities and toggled states.",
  variants: [
    { name: "neutral", props: {}, children: "shares context" },
    { name: "accent", props: { tone: "accent" }, children: "on" },
    { name: "working", props: { tone: "working" }, children: "working" },
    { name: "blocked", props: { tone: "blocked" }, children: "blocked" },
    { name: "done", props: { tone: "done" }, children: "done" },
    { name: "failed", props: { tone: "failed" }, children: "failed" },
  ],
};
