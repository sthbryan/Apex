import type { ComponentMeta } from "@/lib/meta";
import { Button } from "@/atoms/button/Button";

export const buttonMeta: ComponentMeta = {
  name: "Button",
  component: Button,
  layer: "atom",
  description: "Primary interactive control in four intents and four sizes.",
  variants: [
    { name: "primary", props: { variant: "primary" }, children: "Start race" },
    { name: "ghost", props: { variant: "ghost" }, children: "Cancel" },
    { name: "subtle", props: { variant: "subtle" }, children: "Move to sidebar" },
    { name: "danger", props: { variant: "danger" }, children: "Delete worktree" },
    { name: "dashed", props: { variant: "dashed" }, children: "+ New session" },
    { name: "loading", props: { variant: "primary", loading: true }, children: "Starting" },
    { name: "disabled", props: { variant: "primary", disabled: true }, children: "Start race" },
    { name: "xs", props: { variant: "ghost", size: "xs" }, children: "xs" },
    { name: "sm", props: { variant: "ghost", size: "sm" }, children: "sm" },
    { name: "md", props: { variant: "ghost", size: "md" }, children: "md" },
    { name: "lg", props: { variant: "ghost", size: "lg" }, children: "lg" },
  ],
};
