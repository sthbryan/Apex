import { afterEach, describe, expect, it, vi } from "vitest";
import { slugify, suggestName } from "./naming";

afterEach(() => {
  vi.useRealTimers();
});

describe("slugify", () => {
  it("lowers the case and joins the words with a dash", () => {
    expect(slugify("Fix The Login")).toBe("fix-the-login");
  });

  it("collapses a run of punctuation into a single dash", () => {
    expect(slugify("fix -- the __ login!!")).toBe("fix-the-login");
  });

  it("trims the dashes off both ends", () => {
    expect(slugify("  hello  ")).toBe("hello");
    expect(slugify("--hello--")).toBe("hello");
  });

  it("drops accents and anything else git would not take", () => {
    expect(slugify("año 2026 ñandú")).toBe("a-o-2026-and");
  });

  it("falls back to a placeholder rather than an empty branch name", () => {
    expect(slugify("!!!")).toBe("…");
    expect(slugify("")).toBe("…");
  });
});

describe("suggestName", () => {
  it("pads the month and the day to two digits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 12));

    expect(suggestName("claude")).toBe("claude-0105");
  });

  it("keeps two digits for a month that already has them", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 23, 12));

    expect(suggestName("codex")).toBe("codex-1123");
  });
});
