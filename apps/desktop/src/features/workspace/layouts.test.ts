import { describe, expect, it } from "vitest";
import type { PaneView } from "./tree";
import { leaf, leaves } from "./tree";
import { buildLayout, countPanes, LAYOUT_PRESETS, mainSlot } from "./layouts";

function view(id: string): PaneView {
  return { type: "session", sessionId: id };
}

describe("countPanes", () => {
  it("counts a single pane", () => {
    expect(countPanes({ type: "pane" })).toBe(1);
  });

  it("counts leaves through splits", () => {
    expect(countPanes({ type: "split", direction: "row", first: { type: "pane" }, second: { type: "pane" } })).toBe(2);
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
    expect(countPanes(LAYOUT_PRESETS.find((p) => p.id === "twoColumns")!.spec)).toBe(2);
    expect(countPanes(LAYOUT_PRESETS.find((p) => p.id === "threeColumns")!.spec)).toBe(3);
    expect(countPanes(LAYOUT_PRESETS.find((p) => p.id === "grid")!.spec)).toBe(4);
    expect(countPanes(LAYOUT_PRESETS.find((p) => p.id === "sixGrid")!.spec)).toBe(6);
    expect(countPanes(LAYOUT_PRESETS.find((p) => p.id === "mainStackThree")!.spec)).toBe(4);
    expect(countPanes(LAYOUT_PRESETS.find((p) => p.id === "mainStackFour")!.spec)).toBe(5);
  });
});

describe("mainSlot", () => {
  it("returns -1 when no pane is main", () => {
    expect(mainSlot({ type: "pane" })).toBe(-1);
    expect(mainSlot(LAYOUT_PRESETS.find((p) => p.id === "twoColumns")!.spec)).toBe(-1);
    expect(mainSlot(LAYOUT_PRESETS.find((p) => p.id === "grid")!.spec)).toBe(-1);
  });

  it("finds the main pane index depth-first", () => {
    expect(mainSlot(LAYOUT_PRESETS.find((p) => p.id === "mainLeft")!.spec)).toBe(0);
    expect(mainSlot(LAYOUT_PRESETS.find((p) => p.id === "mainTop")!.spec)).toBe(0);
    expect(mainSlot(LAYOUT_PRESETS.find((p) => p.id === "mainRight")!.spec)).toBe(2);
    expect(mainSlot(LAYOUT_PRESETS.find((p) => p.id === "mainBottom")!.spec)).toBe(2);
    expect(mainSlot(LAYOUT_PRESETS.find((p) => p.id === "mainStackThree")!.spec)).toBe(0);
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
    const spec = LAYOUT_PRESETS.find((p) => p.id === "twoColumns")!.spec;
    const root = buildLayout(spec, [view("a"), view("b")]);

    expect(leaves(root).map((l) => (l.view as { sessionId: string }).sessionId)).toEqual(["a", "b"]);
  });

  it("places the seed view into the main slot", () => {
    const spec = LAYOUT_PRESETS.find((p) => p.id === "mainRight")!.spec;
    const root = buildLayout(spec, [view("seed"), view("x"), view("y")]);
    const ids = leaves(root).map((l) => (l.view as { sessionId: string }).sessionId);

    expect(ids).toEqual(["x", "y", "seed"]);
  });

  it("falls back to slot 0 order when no main", () => {
    const spec = LAYOUT_PRESETS.find((p) => p.id === "grid")!.spec;
    const root = buildLayout(spec, [view("a"), view("b"), view("c"), view("d")]);

    expect(leaves(root).map((l) => (l.view as { sessionId: string }).sessionId)).toEqual(["a", "b", "c", "d"]);
  });

  it("fills missing views with a panel fallback", () => {
    const spec = LAYOUT_PRESETS.find((p) => p.id === "threeColumns")!.spec;
    const root = buildLayout(spec, [view("only")]);
    const vs = leaves(root).map((l) => l.view);

    expect(vs[0]).toEqual(view("only"));
    expect(vs[1]).toEqual({ type: "panel", panel: "sessions" });
    expect(vs[2]).toEqual({ type: "panel", panel: "sessions" });
  });

  it("ignores extra views beyond pane count", () => {
    const spec = LAYOUT_PRESETS.find((p) => p.id === "twoColumns")!.spec;
    const root = buildLayout(spec, [view("a"), view("b"), view("c")]);

    expect(leaves(root)).toHaveLength(2);
  });

  it("preserves direction and ratio", () => {
    const spec = LAYOUT_PRESETS.find((p) => p.id === "mainLeft")!.spec;
    const root = buildLayout(spec, [view("a"), view("b"), view("c")]);

    expect(root.kind).toBe("split");
    if (root.kind === "split") {
      expect(root.direction).toBe("row");
      expect(root.ratio).toBe(0.6);
    }
  });

  it("creates unique ids", () => {
    const spec = LAYOUT_PRESETS.find((p) => p.id === "twoColumns")!.spec;
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
