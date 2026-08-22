import type { ComponentMeta } from "@/lib/meta";
import { Notice } from "@/molecules/notice/Notice";

export const noticeMeta: ComponentMeta = {
  name: "Notice",
  component: Notice,
  layer: "molecule",
  description: "Inline note about something that failed, is missing, or needs a yes.",
  rule: "Lives where the problem is. A notice with actions asks once and never blocks the view.",
  variants: [
    { name: "failed", props: { tone: "failed" }, children: "grok quota unavailable" },
    { name: "blocked", props: { tone: "blocked" }, children: "The worktree has uncommitted changes." },
    { name: "done", props: { tone: "done" }, children: "Removed apex-docs" },
    { name: "neutral", props: {}, children: "Nothing running." },
  ],
};
