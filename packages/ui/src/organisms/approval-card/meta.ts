import type { ComponentMeta } from "@/lib/meta";
import { ApprovalCard } from "@/organisms/approval-card/ApprovalCard";

export const approvalCardMeta: ComponentMeta = {
  name: "ApprovalCard",
  layer: "organism",
  description: "An agent asking for permission, with what it wants to run.",
  rule: "Always show the exact command, and how long the agent has been waiting.",
  component: ApprovalCard,
  variants: [
    {
      name: "command",
      props: {
        question: "Run a migration on the dev database?",
        command: "bun run db:migrate --name passkeys",
        meta: "idle 2m",
        approveLabel: "Yes, run it",
      },
    },
    {
      name: "install",
      props: {
        question: "Install the flaky-test tracker?",
        command: "bun add -d @apex/flake-tracker",
        meta: "idle 5m",
      },
    },
    {
      name: "no command",
      props: { question: "Push apex/claude to origin?", meta: "idle 40s", approveLabel: "Push" },
    },
  ],
};
