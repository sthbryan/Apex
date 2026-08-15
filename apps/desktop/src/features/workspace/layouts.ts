import type { Direction, PaneNode, PaneView } from "@/features/workspace/tree";
import { leaf, newId } from "@/features/workspace/tree";

export type LayoutSpec =
  | { type: "pane" }
  | { type: "split"; direction: Direction; ratio?: number; first: LayoutSpec; second: LayoutSpec };

export type LayoutPreset = {
  id: string;
  nameKey:
    | "layout.twoColumns"
    | "layout.twoRows"
    | "layout.grid"
    | "layout.mainLeft"
    | "layout.mainTop";
  preview: string[];
  spec: LayoutSpec;
};

const pane = (): LayoutSpec => ({ type: "pane" });

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "twoColumns",
    nameKey: "layout.twoColumns",
    preview: ["┌─────┬─────┐", "│     │     │", "└─────┴─────┘"],
    spec: { type: "split", direction: "row", first: pane(), second: pane() },
  },
  {
    id: "twoRows",
    nameKey: "layout.twoRows",
    preview: ["┌─────────┐", "│         │", "├─────────┤", "│         │", "└─────────┘"],
    spec: { type: "split", direction: "column", first: pane(), second: pane() },
  },
  {
    id: "grid",
    nameKey: "layout.grid",
    preview: ["┌─────┬─────┐", "├─────┼─────┤", "└─────┴─────┘"],
    spec: {
      type: "split",
      direction: "row",
      first: { type: "split", direction: "column", first: pane(), second: pane() },
      second: { type: "split", direction: "column", first: pane(), second: pane() },
    },
  },
  {
    id: "mainLeft",
    nameKey: "layout.mainLeft",
    preview: ["┌─────┬─────┐", "│     ├─────┤", "│     │     │", "└─────┴─────┘"],
    spec: {
      type: "split",
      direction: "row",
      ratio: 0.6,
      first: pane(),
      second: { type: "split", direction: "column", first: pane(), second: pane() },
    },
  },
  {
    id: "mainTop",
    nameKey: "layout.mainTop",
    preview: ["┌─────────┐", "│         │", "├─────┬───┤", "│     │   │", "└─────┴───┘"],
    spec: {
      type: "split",
      direction: "column",
      ratio: 0.6,
      first: pane(),
      second: { type: "split", direction: "row", first: pane(), second: pane() },
    },
  },
];

export function countPanes(spec: LayoutSpec): number {
  return spec.type === "pane" ? 1 : countPanes(spec.first) + countPanes(spec.second);
}

export function buildLayout(spec: LayoutSpec, views: PaneView[]): PaneNode {
  let index = 0;
  const build = (node: LayoutSpec): PaneNode => {
    if (node.type === "pane") {
      const view = views[index];
      index += 1;
      return leaf(view ?? { type: "panel", panel: "sessions" });
    }
    return {
      kind: "split",
      id: newId(),
      direction: node.direction,
      ratio: node.ratio ?? 0.5,
      first: build(node.first),
      second: build(node.second),
    };
  };
  return build(spec);
}
