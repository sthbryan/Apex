import type { ComponentMeta } from "@/lib/meta";
import { Toast } from "@/organisms/toast/Toast";

export const toastMeta: ComponentMeta = {
  name: "Toast",
  component: Toast,
  layer: "organism",
  description: "Transient notification with optional auto-dismiss progress.",
  rule: "Report what already happened. Never ask a question in a toast.",
  variants: [
    { name: "accent", props: { title: "Codex finished", detail: "exit 0" } },
    { name: "done", props: { title: "Race won by claude", detail: "14 files · +382 −96", tone: "done" } },
    { name: "failed", props: { title: "Build failed", detail: "exit 1", tone: "failed" } },
    { name: "with timer", props: { title: "Codex finished", detail: "exit 0", duration: 6000 } },
  ],
};
