import type { ComponentMeta } from "@/lib/meta";
import { Glyph } from "@/atoms/glyph/Glyph";

export const glyphMeta: ComponentMeta = {
  name: "Glyph",
  component: Glyph,
  layer: "atom",
  description: "Tinted tile that holds one icon at a fixed size.",
  rule: "Decoration around an icon, never a control. It is hidden from screen readers.",
  variants: [
    { name: "md", props: {}, children: "◆" },
    { name: "sm", props: { size: "sm" }, children: "◆" },
    { name: "lg", props: { size: "lg" }, children: "◆" },
    { name: "neutral", props: { tone: "neutral" }, children: "◆" },
  ],
};
