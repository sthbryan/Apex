import { describe, expect, it } from "vitest";
import { buildLayout, countPanes, LAYOUT_PRESETS, type LayoutSpec, mainSlot } from "./layouts";
import type { PaneView } from "./tree";
import { leaf, leaves } from "./tree";

function preset(id: string): LayoutSpec {
  const found = LAYOUT_PRESETS.find((candidate) => candidate.id === id);
  if (!found) {
    throw new Error(`no preset called ${id}`);
  }
  return found.spec;
}

function view(id: string): PaneView {
  return { type: "session", sessionId: id };
}

describe("countPanes", () => {
  it("counts a single pane", () => {
    expect(countPanes({ type: "pane" })).toBe(1);
  });

  it("counts leaves through splits", () => {
    expect(
      countPanes({
        type: "split",
        direction: "row",
        first: { type: "pane" },
        second: { type: "pane" },
      }),
    ).toBe(2);
    expect(
      countPanes({
        type: "split",
        direction: "row",
        first: { type: "pane" },
        second: {
          type: "split",
          direction: "row",
          first: { type: "pane" },
          second: { type: "pane" },
        },
      }),
    ).toBe(3);
  });

  it("matches every preset", () => {
    expect(countPanes(preset("twoColumns"))).toBe(2);
    expect(countPanes(preset("threeColumns"))).toBe(3);
    expect(countPanes(preset("grid"))).toBe(4);
    expect(countPanes(preset("sixGrid"))).toBe(6);
    expect(countPanes(preset("mainStackThree"))).toBe(4);
    expect(countPanes(preset("mainStackFour"))).toBe(5);
  });
});

describe("mainSlot", () => {
  it("returns -1 when no pane is main", () => {
    expect(mainSlot({ type: "pane" })).toBe(-1);
    expect(mainSlot(preset("twoColumns"))).toBe(-1);
    expect(mainSlot(preset("grid"))).toBe(-1);
  });

  it("finds the main pane index depth-first", () => {
    expect(mainSlot(preset("mainLeft"))).toBe(0);
    expect(mainSlot(preset("mainTop"))).toBe(0);
    expect(mainSlot(preset("mainRight"))).toBe(2);
    expect(mainSlot(preset("mainBottom"))).toBe(2);
    expect(mainSlot(preset("mainStackThree"))).toBe(0);
  });

  it("returns the first main when two are marked", () => {
    expect(
      mainSlot({
        type: "split",
        direction: "row",
        first: { type: "pane", main: true },
        second: { type: "pane", main: true },
      }),
    ).toBe(0);
  });
});

describe("buildLayout", () => {
  it("fills a plain spec in order", () => {
    const spec = preset("twoColumns");
    const root = buildLayout(spec, [view("a"), view("b")]);

    expect(leaves(root).map((l) => (l.view as { sessionId: string }).sessionId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("places the seed view into the main slot", () => {
    const spec = preset("mainRight");
    const root = buildLayout(spec, [view("seed"), view("x"), view("y")]);
    const ids = leaves(root).map((l) => (l.view as { sessionId: string }).sessionId);

    expect(ids).toEqual(["x", "y", "seed"]);
  });

  it("falls back to slot 0 order when no main", () => {
    const spec = preset("grid");
    const root = buildLayout(spec, [view("a"), view("b"), view("c"), view("d")]);

    expect(leaves(root).map((l) => (l.view as { sessionId: string }).sessionId)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("fills missing views with a panel fallback", () => {
    const spec = preset("threeColumns");
    const root = buildLayout(spec, [view("only")]);
    const vs = leaves(root).map((l) => l.view);

    expect(vs[0]).toEqual(view("only"));
    expect(vs[1]).toEqual({ type: "panel", panel: "sessions" });
    expect(vs[2]).toEqual({ type: "panel", panel: "sessions" });
  });

  it("ignores extra views beyond pane count", () => {
    const spec = preset("twoColumns");
    const root = buildLayout(spec, [view("a"), view("b"), view("c")]);

    expect(leaves(root)).toHaveLength(2);
  });

  it("preserves direction and ratio", () => {
    const spec = preset("mainLeft");
    const root = buildLayout(spec, [view("a"), view("b"), view("c")]);

    expect(root.kind).toBe("split");
    if (root.kind === "split") {
      expect(root.direction).toBe("row");
      expect(root.ratio).toBe(0.6);
    }
  });

  it("creates unique ids", () => {
    const spec = preset("twoColumns");
    const a = buildLayout(spec, [view("x"), view("y")]);
    const b = buildLayout(spec, [view("x"), view("y")]);

    const ids = [...leaves(a).map((l) => l.id), ...leaves(b).map((l) => l.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaf helper carries view", () => {
    const l = leaf(view("z"));
    expect(l.view).toEqual(view("z"));
    expect(l.kind).toBe("leaf");
  });
});

describe("the presets as a set", () => {
  it("build a tree with exactly the panes they promise", () => {
    for (const preset of LAYOUT_PRESETS) {
      const slots = countPanes(preset.spec);
      const views = Array.from({ length: slots }, (_, index) => view(String(index)));

      expect(leaves(buildLayout(preset.spec, views))).toHaveLength(slots);
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
