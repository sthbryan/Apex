import type { ComponentMeta } from "@/lib/meta";
import { RailButton } from "@/organisms/rail/Rail";

export const railMeta: ComponentMeta = {
  name: "Rail",
  layer: "organism",
  description: "Vertical icon navigation with per-item state badges.",
  rule: "Destinations, not actions. Badges mirror state, never counts.",
  component: RailButton,
  variants: [
    { name: "default", props: { label: "Summary" }, children: "◧" },
    { name: "current", props: { label: "Sessions", current: true }, children: "◧" },
    { name: "working", props: { label: "Races", badge: "working" }, children: "◧" },
    { name: "blocked", props: { label: "Review", badge: "blocked" }, children: "◧" },
    { name: "dirty", props: { label: "Git", badge: "dirty" }, children: "◧" },
  ],
};
