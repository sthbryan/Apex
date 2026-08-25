import { describe, expect, it } from "vitest";
import { paneIcon, paneSubtitle, paneTitle } from "./title";

describe("paneTitle", () => {
  it("uses the file name", () => {
    expect(paneTitle({ type: "file", path: "a/b/c.ts" }, [])).toBe("c.ts");
  });

  it("prefixes a diff with ±", () => {
    expect(
      paneTitle(
        { type: "diff", target: { type: "project" }, path: "src/one.ts", commit: null },
        [],
      ),
    ).toBe("± one.ts");
  });

  it("falls back to short commit when diff path is empty", () => {
    expect(
      paneTitle(
        { type: "diff", target: { type: "project" }, path: "", commit: "abc123456789" },
        [],
      ),
    ).toBe("± abc1234");
  });

  it("resolves a panel label", () => {
    expect(paneTitle({ type: "panel", panel: "sessions" }, [])).toBe("Sessions");
  });

  it("falls back to raw panel id when unknown", () => {
    expect(paneTitle({ type: "panel", panel: "unknown" }, [])).toBe("unknown");
  });

  it("returns translated race title", () => {
    expect(paneTitle({ type: "race", run: "x" }, [])).toBe("Races");
  });

  it("prefers the session title when present", () => {
    expect(
      paneTitle({ type: "session", sessionId: "abc123" }, [
        { id: "abc123", title: "My Session" } as never,
      ]),
    ).toBe("My Session");
  });

  it("falls back to short id when session title is missing", () => {
    expect(paneTitle({ type: "session", sessionId: "abc123456789" }, [])).toBe("abc12345");
  });
});

describe("paneIcon", () => {
  it("maps each view to an icon", () => {
    expect(paneIcon({ type: "file", path: "a.ts" })).toBe("file");
    expect(
      paneIcon({ type: "diff", target: { type: "project" }, path: "a.ts", commit: null }),
    ).toBe("branch");
    expect(paneIcon({ type: "race", run: "x" })).toBe("swap");
    expect(paneIcon({ type: "session", sessionId: "x" })).toBe("sessions");
  });

  it("uses the panel icon when present", () => {
    expect(paneIcon({ type: "panel", panel: "sessions" })).toBeDefined();
  });
});

describe("paneSubtitle", () => {
  it("returns the folder for file, never the name the title already shows", () => {
    expect(paneSubtitle({ type: "file", path: "a/b.ts" })).toBe("a");
    expect(paneSubtitle({ type: "file", path: "b.ts" })).toBeNull();
  });

  it("returns folder or commit for diff", () => {
    expect(
      paneSubtitle({ type: "diff", target: { type: "project" }, path: "src/a.ts", commit: null }),
    ).toBe("src");
    expect(
      paneSubtitle({ type: "diff", target: { type: "project" }, path: "", commit: "abc" }),
    ).toBe("abc");
  });

  it("returns null for a session", () => {
    expect(paneSubtitle({ type: "session", sessionId: "x" })).toBeNull();
  });
});
