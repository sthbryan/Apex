import { describe, expect, it } from "vitest";
import {
  clampRatio,
  findLeaf,
  type Leaf,
  leaf,
  leaves,
  neighbourLeaf,
  opposite,
  type PaneNode,
  referencedSession,
  removeLeaf,
  sessionOf,
  setRatio,
  setView,
  siblingOf,
  splitLeaf,
  stack,
  swapViews,
  withMain,
} from "./tree";

function session(id: string): Leaf {
  return leaf({ type: "session", sessionId: id });
}

function ids(node: PaneNode): string[] {
  return leaves(node).map((pane) => (pane.view.type === "session" ? pane.view.sessionId : "?"));
}

describe("splitLeaf", () => {
  it("puts the incoming pane after the target when the direction runs forward", () => {
    const target = session("a");
    const split = splitLeaf(target, target.id, "row", session("b"));

    expect(ids(split)).toEqual(["a", "b"]);
  });

  it("puts the incoming pane before the target when the direction is reversed", () => {
    const target = session("a");
    const split = splitLeaf(target, target.id, "row-reverse", session("b"));

    expect(ids(split)).toEqual(["b", "a"]);
  });

  it("leaves the tree alone when nothing matches the target", () => {
    const tree = session("a");

    expect(splitLeaf(tree, "nobody", "row", session("b"))).toBe(tree);
  });

  it("reaches a leaf buried under a split", () => {
    const first = session("a");
    const second = session("b");
    const tree = splitLeaf(first, first.id, "row", second);

    expect(ids(splitLeaf(tree, second.id, "column", session("c")))).toEqual(["a", "b", "c"]);
  });
});

describe("removeLeaf", () => {
  it("collapses the split and promotes the surviving sibling", () => {
    const first = session("a");
    const tree = splitLeaf(first, first.id, "row", session("b"));
    const left = removeLeaf(tree, leaves(tree)[1].id);

    expect(left).not.toBeNull();
    expect(left?.kind).toBe("leaf");
    expect(ids(left as PaneNode)).toEqual(["a"]);
  });

  it("returns null when the last pane goes", () => {
    const only = session("a");

    expect(removeLeaf(only, only.id)).toBeNull();
  });

  it("keeps the tree whole when the id belongs to nobody", () => {
    const first = session("a");
    const tree = splitLeaf(first, first.id, "row", session("b"));

    expect(ids(removeLeaf(tree, "nobody") as PaneNode)).toEqual(["a", "b"]);
  });
});

describe("swapViews", () => {
  it("trades the two views and leaves the pane ids where they were", () => {
    const first = session("a");
    const tree = splitLeaf(first, first.id, "row", session("b"));
    const before = leaves(tree).map((pane) => pane.id);
    const swapped = swapViews(tree, before[0], before[1]);

    expect(ids(swapped)).toEqual(["b", "a"]);
    expect(leaves(swapped).map((pane) => pane.id)).toEqual(before);
  });

  it("does nothing when one of the two panes is gone", () => {
    const first = session("a");
    const tree = splitLeaf(first, first.id, "row", session("b"));

    expect(swapViews(tree, leaves(tree)[0].id, "nobody")).toBe(tree);
  });
});

describe("setRatio", () => {
  it("clamps the ratio into the range a pane can still be seen at", () => {
    const first = session("a");
    const tree = splitLeaf(first, first.id, "row", session("b")) as PaneNode & { kind: "split" };

    expect((setRatio(tree, tree.id, 5) as typeof tree).ratio).toBe(0.9);
    expect((setRatio(tree, tree.id, -5) as typeof tree).ratio).toBe(0.1);
  });
});

describe("clampRatio", () => {
  it("leaves a sane ratio untouched", () => {
    expect(clampRatio(0.42)).toBe(0.42);
  });
});

describe("neighbourLeaf", () => {
  it("hands back the pane on the right, and the left one for the last pane", () => {
    const first = session("a");
    const two = splitLeaf(first, first.id, "row", session("b"));
    const tree = splitLeaf(two, leaves(two)[1].id, "row", session("c"));
    const all = leaves(tree);

    expect(neighbourLeaf(tree, all[0].id)?.id).toBe(all[1].id);
    expect(neighbourLeaf(tree, all[2].id)?.id).toBe(all[1].id);
  });

  it("has nobody to offer for a pane outside the tree", () => {
    expect(neighbourLeaf(session("a"), "nobody")).toBeNull();
  });
});

describe("siblingOf", () => {
  it("finds the pane sharing the split", () => {
    const first = session("a");
    const tree = splitLeaf(first, first.id, "row", session("b"));
    const all = leaves(tree);

    expect(siblingOf(tree, all[0].id)?.id).toBe(all[1].id);
    expect(siblingOf(tree, all[1].id)?.id).toBe(all[0].id);
  });

  it("refuses when the sibling is a whole split rather than one pane", () => {
    const first = session("a");
    const two = splitLeaf(first, first.id, "row", session("b"));
    const tree = splitLeaf(two, leaves(two)[1].id, "column", session("c"));

    expect(siblingOf(tree, leaves(tree)[0].id)).toBeNull();
  });
});

describe("withMain", () => {
  it("gives the main pane half the room and stacks the rest beside it", () => {
    const tree = withMain(session("a"), [session("b"), session("c")], "row");

    expect(tree.kind).toBe("split");
    expect(ids(tree)).toEqual(["a", "b", "c"]);
    expect((tree as { ratio: number }).ratio).toBe(0.5);
  });

  it("stays a single pane when there is nobody to stack", () => {
    const main = session("a");

    expect(withMain(main, [], "row")).toBe(main);
  });
});

describe("sessionOf", () => {
  it("returns the session id for session views", () => {
    expect(sessionOf(session("abc"))).toBe("abc");
  });

  it("returns null for other views", () => {
    expect(sessionOf(leaf({ type: "file", path: "a.ts" }))).toBeNull();
    expect(sessionOf(leaf({ type: "panel", panel: "sessions" }))).toBeNull();
  });
});

describe("referencedSession", () => {
  it("returns the session id directly", () => {
    expect(referencedSession(session("x"))).toBe("x");
  });

  it("returns the target id for session diffs", () => {
    expect(
      referencedSession(
        leaf({ type: "diff", target: { type: "session", id: "s1" }, path: "a.ts", commit: null }),
      ),
    ).toBe("s1");
  });

  it("returns null for project diffs and files", () => {
    expect(
      referencedSession(
        leaf({ type: "diff", target: { type: "project" }, path: "a.ts", commit: null }),
      ),
    ).toBeNull();
    expect(referencedSession(leaf({ type: "file", path: "a.ts" }))).toBeNull();
  });
});

describe("findLeaf", () => {
  it("finds a leaf by id", () => {
    const a = session("a");
    expect(findLeaf(a, a.id)).toBe(a);
    expect(findLeaf(a, "nope")).toBeNull();
  });
});

describe("setView", () => {
  it("replaces the view of the targeted leaf", () => {
    const a = session("a");
    const next = setView(a, a.id, { type: "file", path: "x.ts" });
    expect(next.kind).toBe("leaf");
    if (next.kind === "leaf") expect(next.view).toEqual({ type: "file", path: "x.ts" });
  });

  it("leaves other leaves untouched", () => {
    const a = session("a");
    expect(setView(a, "nope", { type: "file", path: "x.ts" })).toBe(a);
  });
});

describe("opposite", () => {
  it("swaps row and column", () => {
    expect(opposite("row")).toBe("column");
    expect(opposite("column")).toBe("row");
    expect(opposite("row-reverse")).toBe("column");
    expect(opposite("column-reverse")).toBe("row");
  });
});

describe("stack", () => {
  it("returns the single pane when only one", () => {
    const a = session("a");
    expect(stack([a], "row")).toBe(a);
  });

  it("creates a balanced split for multiple panes", () => {
    const panes = [session("a"), session("b"), session("c"), session("d")];
    const root = stack(panes, "row");
    expect(leaves(root).map((l) => (l.view as { sessionId: string }).sessionId)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(root.kind).toBe("split");
  });

  it("alternates direction on recursion", () => {
    const panes = [session("a"), session("b"), session("c")];
    const root = stack(panes, "row");
    expect(root.kind).toBe("split");
    if (root.kind === "split") {
      expect(root.direction).toBe("row");
      expect(root.first.kind).toBe("split");
      if (root.first.kind === "split") expect(root.first.direction).toBe("column");
    }
  });
});
