import { describe, expect, it } from "vitest";
import { countdown, roughly, tone } from "./format";

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
