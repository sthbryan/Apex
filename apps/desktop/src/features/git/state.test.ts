import { describe, expect, it, vi } from "vitest";
import { sameTarget, since } from "./state";

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
    expect(sameTarget({ type: "worktree", path: "/a" }, { type: "worktree", path: "/a" })).toBe(
      true,
    );
    expect(sameTarget({ type: "worktree", path: "/a" }, { type: "worktree", path: "/b" })).toBe(
      false,
    );
  });
});

describe("since", () => {
  it("returns relative time when recent", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const when = Date.now() / 1000 - 60;
    expect(since(when)).toBe("1m");
    vi.useRealTimers();
  });

  it("falls back to just now when in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const future = Date.now() / 1000 + 10;
    expect(since(future)).toBe("just now");
    vi.useRealTimers();
  });
});
