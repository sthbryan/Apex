import { describe, expect, it } from "vitest";
import { spellClock } from "@/features/acp/AcpView";

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
