import type { ComponentMeta } from "@/lib/meta";
import { Surface } from "@/atoms/surface/Surface";

export const surfaceMeta: ComponentMeta = {
  name: "Surface",
  component: Surface,
  layer: "atom",
  description: "Elevation primitive. Set blur only on a stacking layer root so veil never compounds.",
  rule: "Set blur on a stacking-layer root only. Nested veil compounds and turns to mud.",
  variants: [
    { name: "bg", props: { elevation: "bg", bordered: true, radius: "md" } },
    { name: "surface", props: { elevation: "surface", bordered: true, radius: "md" } },
    { name: "raised", props: { elevation: "raised", bordered: true, radius: "md" } },
    { name: "overlay", props: { elevation: "overlay", bordered: true, radius: "md", shadow: "lg", blur: true } },
    { name: "tty", props: { elevation: "tty", bordered: true, radius: "md" } },
  ],
};
