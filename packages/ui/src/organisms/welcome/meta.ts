import type { ComponentMeta } from "@/lib/meta";
import { Welcome } from "@/organisms/welcome/Welcome";

export const welcomeMeta: ComponentMeta = {
  name: "Welcome",
  component: Welcome,
  layer: "organism",
  description: "The first screen: the mark, one line of what this is, and the way in.",
  rule: "One way in. Suggestions are shortcuts to it, never a second path.",
  variants: [
    { name: "tagline", props: { tagline: "Run a team of AI agents, not a wall of terminals." } },
  ],
};
