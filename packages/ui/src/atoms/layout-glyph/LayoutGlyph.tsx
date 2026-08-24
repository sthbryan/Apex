import type { JSX } from "preact";
import { cn } from "@/lib/cn";

export type LayoutShape =
  | { type: "pane"; main?: boolean }
  | { type: "split"; direction: string; ratio?: number; first: LayoutShape; second: LayoutShape };

export interface LayoutGlyphProps extends Omit<JSX.IntrinsicElements["span"], "ref"> {
  shape: LayoutShape;
  label?: string;
}

export function LayoutGlyph({ shape, label, class: className, ...rest }: LayoutGlyphProps) {
  return (
    <span class={cn("ui-layout-glyph", className as string)} role="img" aria-label={label} {...rest}>
      <Cell shape={shape} grow={1} />
    </span>
  );
}

function Cell({ shape, grow }: { shape: LayoutShape; grow: number }) {
  const style = `flex:${grow} 1 0%`;
  if (shape.type === "pane") {
    return <span class="ui-layout-pane" data-main={shape.main || undefined} style={style} />;
  }
  const ratio = shape.ratio ?? 0.5;
  return (
    <span class="ui-layout-split" data-axis={shape.direction.startsWith("row") ? "row" : "col"} style={style}>
      <Cell shape={shape.first} grow={ratio} />
      <Cell shape={shape.second} grow={1 - ratio} />
    </span>
  );
}
