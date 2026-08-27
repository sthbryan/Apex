import { describe, expect, it } from "vitest";
import type { AcpPermission } from "@/bindings/AcpPermission";
import { asking, spellClock } from "@/features/acp/AcpView";

function ask(kinds: string[]): AcpPermission {
  return {
    request: 1,
    title: "well?",
    decided: null,
    group: null,
    at: 0,
    of: 0,
    options: kinds.map((kind, index) => ({ id: `${index}`, name: kind, about: null, kind })),
  };
}

describe("telling a question from a permission", () => {
  it("reads anything the agent can allow as a permission", () => {
    expect(asking(ask(["allow_once", "reject_once"]))).toBe(false);
    expect(asking(ask(["allow_always", "reject_always"]))).toBe(false);
  });

  it("reads a set of plain answers as a question", () => {
    expect(asking(ask(["other", "other", "other"]))).toBe(true);
  });

  it("still counts a lone refusal among plain answers as a question", () => {
    expect(asking(ask(["other", "reject_once"]))).toBe(true);
  });
});

describe("saying when something arrived", () => {
  const noon = new Date(2026, 7, 26, 12, 30).getTime();

  it("says nothing for an entry that was never stamped", () => {
    expect(spellClock(0, noon)).toBe("");
  });

  it("gives just the time for something from today", () => {
    const shown = spellClock(noon, noon + 3 * 3600_000);
    expect(shown).not.toMatch(/\d+\s*\w+\s+\d/);
    expect(shown).toMatch(/12/);
  });

  it("adds the day for something older", () => {
    const shown = spellClock(noon - 3 * 86_400_000, noon);
    expect(shown.length).toBeGreaterThan(spellClock(noon, noon).length);
  });
});
