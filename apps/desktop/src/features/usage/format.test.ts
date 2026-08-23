import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countdown, pacing, resetIn, resetText, roughly, tone } from "./format";

describe("countdown", () => {
  it("drops the minutes once there are days left", () => {
    expect(countdown(2 * 86400 + 3 * 3600 + 40 * 60)).toBe("2d3h");
  });

  it("shows hours and minutes inside a day", () => {
    expect(countdown(3 * 3600 + 5 * 60)).toBe("3h5m");
  });

  it("never counts down to zero minutes while time is left", () => {
    expect(countdown(20)).toBe("1m");
  });

  it("gives up on a window that already reset", () => {
    expect(countdown(0)).toBeNull();
    expect(countdown(-60)).toBeNull();
    expect(countdown(Number.NaN)).toBeNull();
  });
});

describe("roughly", () => {
  it("keeps only the largest unit", () => {
    expect(roughly(2 * 86400 + 20 * 3600)).toBe("2d");
    expect(roughly(3 * 3600 + 59 * 60)).toBe("3h");
    expect(roughly(90)).toBe("1m");
  });

  it("says nothing about time that has passed", () => {
    expect(roughly(0)).toBeNull();
  });
});

describe("tone", () => {
  it("turns red at ninety, amber at seventy and stays quiet below", () => {
    expect(tone(90).bar).toBe("bg-state-failed");
    expect(tone(89).bar).toBe("bg-state-blocked");
    expect(tone(70).bar).toBe("bg-state-blocked");
    expect(tone(69).bar).toBe("bg-muted");
  });
});

describe("resetIn", () => {
  it("returns countdown when resets_at is valid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const window = { resets_at: new Date(Date.now() + 3600000).toISOString() } as never;
    expect(resetIn(window)).toBe("1h0m");
    vi.useRealTimers();
  });

  it("returns null when resets_at is missing or invalid", () => {
    expect(resetIn({ resets_at: null } as never)).toBeNull();
    expect(resetIn({ resets_at: "not-a-date" } as never)).toBeNull();
  });
});

describe("resetText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns resetsIn when time is ahead", () => {
    const window = {
      resets_at: new Date(Date.now() + 7200000).toISOString(),
      reset_description: "later",
    } as never;
    const text = resetText(window);
    expect(text).toContain("resets in");
  });

  it("returns resetsAt when already passed", () => {
    const window = {
      resets_at: new Date(Date.now() - 1000).toISOString(),
      reset_description: "later",
    } as never;
    const text = resetText(window);
    expect(text).toContain("resets");
  });

  it("falls back to reset_description when resets_at is missing", () => {
    expect(resetText({ resets_at: null, reset_description: "tomorrow" } as never)).toBe("tomorrow");
    expect(resetText({ resets_at: null, reset_description: null } as never)).toBe("");
  });

  it("falls back when resets_at is invalid", () => {
    expect(resetText({ resets_at: "bad", reset_description: "soon" } as never)).toBe("soon");
  });
});

describe("pacing", () => {
  it("returns null when lasts_to_reset is null", () => {
    expect(pacing({ lasts_to_reset: null } as never)).toBeNull();
  });

  it("returns onPace when lasts_to_reset is true", () => {
    expect(pacing({ lasts_to_reset: true } as never)).toEqual({
      text: "on pace",
      tone: "text-state-done",
    });
  });

  it("returns countdown when eta is present", () => {
    expect(pacing({ lasts_to_reset: false, eta_seconds: 3600 } as never)?.text).toBe("1h0m");
  });

  it("returns overPace when eta is null", () => {
    expect(pacing({ lasts_to_reset: false, eta_seconds: null } as never)).toEqual({
      text: "over pace",
      tone: "text-state-blocked",
    });
  });
});

describe("countdown, at the edges", () => {
  it("handles exactly one day", () => {
    expect(countdown(86400)).toBe("1d0h");
  });
});

describe("roughly, at the edges", () => {
  it("handles exactly one hour", () => {
    expect(roughly(3600)).toBe("1h");
  });
});
