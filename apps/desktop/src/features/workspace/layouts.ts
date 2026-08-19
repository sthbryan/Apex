import type { Direction, PaneNode, PaneView } from "@/features/workspace/tree";
import { leaf, newId } from "@/features/workspace/tree";
import type { MessageKey } from "@/shared/i18n";

export type LayoutName = Extract<MessageKey, `layout.${string}`>;

export type LayoutSpec =
  | { type: "pane"; main?: boolean }
  | { type: "split"; direction: Direction; ratio?: number; first: LayoutSpec; second: LayoutSpec };

export type LayoutPreset = {
  id: string;
  nameKey: LayoutName;
  preview: string[];
  spec: LayoutSpec;
};

const pane = (): LayoutSpec => ({ type: "pane" });
const main = (): LayoutSpec => ({ type: "pane", main: true });

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
    id: "mainLeft",
    nameKey: "layout.mainLeft",
    preview: ["┌─────┬─────┐", "│     ├─────┤", "│     │     │", "└─────┴─────┘"],
    spec: {
      type: "split",
      direction: "row",
      ratio: 0.6,
      first: main(),
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
      first: main(),
      second: { type: "split", direction: "row", first: pane(), second: pane() },
    },
  },
  {
    id: "mainRight",
    nameKey: "layout.mainRight",
    preview: ["┌─────┬─────┐", "├─────┤     │", "│     │     │", "└─────┴─────┘"],
    spec: {
      type: "split",
      direction: "row",
      ratio: 0.4,
      first: { type: "split", direction: "column", first: pane(), second: pane() },
      second: main(),
    },
  },
  {
    id: "mainBottom",
    nameKey: "layout.mainBottom",
    preview: ["┌─────┬───┐", "│     │   │", "├─────┴───┤", "│         │", "└─────────┘"],
    spec: {
      type: "split",
      direction: "column",
      ratio: 0.4,
      first: { type: "split", direction: "row", first: pane(), second: pane() },
      second: main(),
    },
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
];

export function countPanes(spec: LayoutSpec): number {
  return spec.type === "pane" ? 1 : countPanes(spec.first) + countPanes(spec.second);
}

export function mainSlot(spec: LayoutSpec): number {
  let index = 0;
  let slot = -1;
  const walk = (node: LayoutSpec): void => {
    if (node.type === "pane") {
      if (node.main && slot === -1) {
        slot = index;
      }
      index += 1;
      return;
    }
    walk(node.first);
    walk(node.second);
  };
  walk(spec);
  return slot;
}

function orderForMain(views: PaneView[], slot: number, slots: number): PaneView[] {
  const [seed, ...rest] = views;
  const ordered: PaneView[] = [];
  for (let index = 0; index < slots; index += 1) {
    const next = index === slot ? seed : rest.shift();
    if (next) {
      ordered[index] = next;
    }
  }
  return ordered;
}

export function buildLayout(spec: LayoutSpec, views: PaneView[]): PaneNode {
  const slot = mainSlot(spec);
  const ordered = slot <= 0 ? views : orderForMain(views, slot, countPanes(spec));
  let index = 0;
  const build = (node: LayoutSpec): PaneNode => {
    if (node.type === "pane") {
      const view = ordered[index];
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
