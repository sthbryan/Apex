import type { ComponentMeta } from "@/lib/meta";
import { Modal } from "@/organisms/modal/Modal";

export const modalMeta: ComponentMeta = {
  name: "Modal",
  component: Modal,
  layer: "organism",
  description: "Native dialog with backdrop, escape handling and click-outside close.",
  rule: "For decisions that block. Everything else is a Popover or a pane.",
  variants: [
    { name: "sm", props: { open: true, title: "Close session", width: "sm" }, children: "The worktree stays on disk." },
    { name: "md", props: { open: true, title: "Settings" }, children: "Look, agents and shortcuts." },
    { name: "lg", props: { open: true, title: "Race a task", width: "lg" }, children: "Pick the contenders." },
  ],
};
