import type { ComponentMeta } from "@/lib/meta";
import { ListRow } from "@/molecules/list-row/ListRow";

export const listRowMeta: ComponentMeta = {
  name: "ListRow",
  component: ListRow,
  layer: "molecule",
  description: "Selectable row for sessions, files and tasks.",
  variants: [
    { name: "default", props: { label: "Refactor auth middleware" } },
    { name: "selected", props: { label: "Refactor auth middleware", selected: true } },
    { name: "with sub", props: { label: "Fix flaky checkout tests", sub: "apex/codex · 2 files" } },
    { name: "disabled", props: { label: "Archived worktree", disabled: true } },
    { name: "long label", props: { label: "Rewrite the dock resize handler so it stops jittering on retina displays" } },
  ],
};
