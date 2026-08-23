import { describe, expect, it } from "vitest";
import {
  findLeaf,
  leaf,
  leaves,
  opposite,
  referencedSession,
  sessionOf,
  setView,
  stack,
} from "./tree";
import type { Leaf } from "./tree";

function session(id: string): Leaf {
  return leaf({ type: "session", sessionId: id });
}

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
    expect(referencedSession(leaf({ type: "diff", target: { type: "session", id: "s1" }, path: "a.ts", commit: null }))).toBe("s1");
  });

  it("returns null for project diffs and files", () => {
    expect(referencedSession(leaf({ type: "diff", target: { type: "project" }, path: "a.ts", commit: null }))).toBeNull();
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
    expect(leaves(root).map((l) => (l.view as { sessionId: string }).sessionId)).toEqual(["a", "b", "c", "d"]);
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
