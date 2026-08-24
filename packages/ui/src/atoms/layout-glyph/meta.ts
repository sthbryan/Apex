import type { ComponentMeta } from "@/lib/meta";
import { LayoutGlyph } from "@/atoms/layout-glyph/LayoutGlyph";

const pane = { type: "pane" } as const;

export const layoutGlyphMeta: ComponentMeta = {
  name: "LayoutGlyph",
  layer: "atom",
  description: "The shape a pane layout makes, drawn from the same spec that builds it.",
  rule: "Draw the layout, never spell it. A picture of two columns beats the words two columns.",
  component: LayoutGlyph,
  variants: [
    { name: "two columns", props: { shape: { type: "split", direction: "row", first: pane, second: pane } } },
    { name: "two rows", props: { shape: { type: "split", direction: "column", first: pane, second: pane } } },
    {
      name: "main left",
      props: {
        shape: {
          type: "split",
          direction: "row",
          ratio: 0.6,
          first: { type: "pane", main: true },
          second: { type: "split", direction: "column", first: pane, second: pane },
        },
      },
    },
  ],
};
