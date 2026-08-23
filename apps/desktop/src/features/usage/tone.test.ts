import { describe, expect, it } from "vitest";
import { barTone, readoutTone } from "./tone";

describe("barTone", () => {
  it("turns red at ninety, amber at seventy and stays on accent below", () => {
    expect(barTone(100)).toBe("failed");
    expect(barTone(90)).toBe("failed");
    expect(barTone(89.9)).toBe("blocked");
    expect(barTone(70)).toBe("blocked");
    expect(barTone(69.9)).toBe("accent");
    expect(barTone(0)).toBe("accent");
  });
});

describe("readoutTone", () => {
  it("crosses at the same two marks but rests on done", () => {
    expect(readoutTone(90)).toBe("failed");
    expect(readoutTone(70)).toBe("blocked");
    expect(readoutTone(69.9)).toBe("done");
  });
});
