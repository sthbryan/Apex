import { describe, expect, it } from "vitest";
import { leaves, type PaneNode, type PaneView } from "@/features/workspace/tree";
import { buildLayout, countPanes, LAYOUT_PRESETS, type LayoutSpec, mainSlot } from "./layouts";

function session(id: string): PaneView {
  return { type: "session", sessionId: id };
}

function ids(node: PaneNode): string[] {
  return leaves(node).map((pane) =>
    pane.view.type === "session"
      ? pane.view.sessionId
      : `panel:${(pane.view as { panel: string }).panel}`,
  );
}

const MAIN_LEFT = LAYOUT_PRESETS.find((preset) => preset.id === "mainLeft")?.spec as LayoutSpec;
const MAIN_RIGHT = LAYOUT_PRESETS.find((preset) => preset.id === "mainRight")?.spec as LayoutSpec;
const GRID = LAYOUT_PRESETS.find((preset) => preset.id === "grid")?.spec as LayoutSpec;

describe("countPanes", () => {
  it("counts the leaves of a nested spec", () => {
    expect(countPanes(GRID)).toBe(4);
    expect(countPanes({ type: "pane" })).toBe(1);
    expect(countPanes(LAYOUT_PRESETS.find((p) => p.id === "sixGrid")?.spec as LayoutSpec)).toBe(6);
  });
});

describe("mainSlot", () => {
  it("reports the slot in reading order, not the tree position", () => {
    expect(mainSlot(MAIN_LEFT)).toBe(0);
    expect(mainSlot(MAIN_RIGHT)).toBe(2);
  });

  it("reports nothing when no pane is the main one", () => {
    expect(mainSlot(GRID)).toBe(-1);
  });
});

describe("buildLayout", () => {
  it("fills the slots in order when no pane is the main one", () => {
    const root = buildLayout(GRID, [session("a"), session("b"), session("c"), session("d")]);

    expect(ids(root)).toEqual(["a", "b", "c", "d"]);
  });

  it("seats the seed in the main slot and shifts the rest around it", () => {
    const root = buildLayout(MAIN_RIGHT, [session("seed"), session("b"), session("c")]);

    expect(ids(root)).toEqual(["b", "c", "seed"]);
  });

  it("leaves the order alone when the main slot is already first", () => {
    const root = buildLayout(MAIN_LEFT, [session("seed"), session("b"), session("c")]);

    expect(ids(root)).toEqual(["seed", "b", "c"]);
  });

  it("falls back to the sessions panel for a slot nobody fills", () => {
    const root = buildLayout(GRID, [session("a"), session("b")]);

    expect(ids(root)).toEqual(["a", "b", "panel:sessions", "panel:sessions"]);
  });

  it("still seats the seed when there are fewer views than slots", () => {
    const root = buildLayout(MAIN_RIGHT, [session("seed")]);

    expect(ids(root)).toEqual(["panel:sessions", "panel:sessions", "seed"]);
  });

  it("carries the ratio of the spec and defaults the rest to half", () => {
    const root = buildLayout(MAIN_LEFT, [session("a"), session("b"), session("c")]) as PaneNode & {
      kind: "split";
    };

    expect(root.ratio).toBe(0.6);
    expect((root.second as { ratio: number }).ratio).toBe(0.5);
  });

  it("gives every pane its own id", () => {
    const root = buildLayout(GRID, [session("a"), session("b"), session("c"), session("d")]);
    const seen = new Set(leaves(root).map((pane) => pane.id));

    expect(seen.size).toBe(4);
  });
});

describe("the presets", () => {
  it("build a tree with exactly the panes they promise", () => {
    for (const preset of LAYOUT_PRESETS) {
      const slots = countPanes(preset.spec);
      const views = Array.from({ length: slots }, (_, index) => session(String(index)));

      expect(ids(buildLayout(preset.spec, views))).toHaveLength(slots);
    }
  });

  it("never name two main panes", () => {
    for (const preset of LAYOUT_PRESETS) {
      const mains = JSON.stringify(preset.spec).split('"main":true').length - 1;

      expect(mains).toBeLessThanOrEqual(1);
    }
  });

  it("carry ids nobody repeats", () => {
    const seen = new Set(LAYOUT_PRESETS.map((preset) => preset.id));

    expect(seen.size).toBe(LAYOUT_PRESETS.length);
  });
});
