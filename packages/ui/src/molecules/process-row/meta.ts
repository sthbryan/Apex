import type { ComponentMeta } from "@/lib/meta";
import { ProcessRow } from "@/molecules/process-row/ProcessRow";

export const processRowMeta: ComponentMeta = {
  name: "ProcessRow",
  component: ProcessRow,
  layer: "molecule",
  description: "One live process under the session that spawned it.",
  rule: "Command, pid, memory. Killing it is an action you reveal, never a button in the way.",
  variants: [
    { name: "agent", props: { command: "claude", pid: 4821, mem: "412 MB" } },
    { name: "child", props: { command: "bun test tests/auth.test.ts", pid: 4933, mem: "96 MB" } },
    { name: "no memory", props: { command: "vite", pid: 5120 } },
  ],
};
