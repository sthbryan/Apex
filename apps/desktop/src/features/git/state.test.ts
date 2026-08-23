import { describe, expect, it } from "vitest";
import { sameTarget } from "./state";

describe("sameTarget", () => {
  it("matches project targets", () => {
    expect(sameTarget({ type: "project" }, { type: "project" })).toBe(true);
    expect(sameTarget({ type: "project" }, { type: "session", id: "a" })).toBe(false);
  });

  it("matches session ids", () => {
    expect(sameTarget({ type: "session", id: "a" }, { type: "session", id: "a" })).toBe(true);
    expect(sameTarget({ type: "session", id: "a" }, { type: "session", id: "b" })).toBe(false);
  });

  it("matches worktree paths", () => {
    expect(sameTarget({ type: "worktree", path: "/a" }, { type: "worktree", path: "/a" })).toBe(true);
    expect(sameTarget({ type: "worktree", path: "/a" }, { type: "worktree", path: "/b" })).toBe(false);
  });
});
