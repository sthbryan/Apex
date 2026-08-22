import type { ComponentMeta } from "@/lib/meta";
import { CommitBox } from "@/organisms/commit-box/CommitBox";

export const commitBoxMeta: ComponentMeta = {
  name: "CommitBox",
  layer: "organism",
  description: "Sticky commit composer for the bottom of a changes panel.",
  rule: "It never scrolls with the file list, and the hint carries the warning.",
  component: CommitBox,
  variants: [
    { name: "empty", props: { hint: "Nothing staged", submitDisabled: true } },
    { name: "ready", props: { value: "fix(dock): stop the resize jank", hint: "3 staged on main" } },
    { name: "long subject", props: { value: "refactor the dock resize handler so it stops jittering on retina", hint: "Subject is 64 characters", hintTone: "blocked" } },
    { name: "conflict", props: { value: "merge apex/claude", hint: "Resolve conflicts first", hintTone: "failed", submitDisabled: true } },
  ],
};
