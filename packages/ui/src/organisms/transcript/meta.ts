import type { ComponentMeta } from "@/lib/meta";
import { Message, ToolCall } from "@/organisms/transcript/Transcript";

export const messageMeta: ComponentMeta = {
  name: "Message",
  component: Message,
  layer: "organism",
  description: "One turn in a session, from you or from the agent.",
  rule: "Yours is a bubble on the right. The agent's is plain text you can read fast.",
  variants: [
    { name: "user", props: { from: "user" }, children: "Refactor auth middleware to use passkeys." },
    { name: "agent", props: {}, children: "Passkeys need a challenge store, so I added one behind the session table." },
    { name: "agent with meta", props: { meta: "claude · 2m 14s" }, children: "Tests pass. Want me to commit?" },
  ],
};

export const toolCallMeta: ComponentMeta = {
  name: "ToolCall",
  component: ToolCall,
  layer: "organism",
  description: "A command the agent ran, collapsed to one line until you ask.",
  rule: "Show the exact command and what it cost. Output stays folded.",
  variants: [
    { name: "ok", props: { name: "bash", command: "bun test tests/auth.test.ts", detail: "2.3s" } },
    { name: "running", props: { name: "bash", command: "bun run build", status: "running", detail: "8s" } },
    { name: "failed", props: { name: "bash", command: "bun run typecheck", status: "failed", detail: "exit 1" } },
    { name: "read", props: { name: "read", command: "src/auth/middleware.ts", detail: "142 lines" } },
  ],
};
