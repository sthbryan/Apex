import { describe, expect, it } from "vitest";
import { barTone, readoutTone } from "./tone";

describe("barTone", () => {
  it("returns failed at 90", () => {
    expect(barTone(90)).toBe("failed");
    expect(barTone(100)).toBe("failed");
  });

  it("returns blocked at 70", () => {
    expect(barTone(70)).toBe("blocked");
    expect(barTone(89)).toBe("blocked");
  });

  it("returns accent below 70", () => {
    expect(barTone(69)).toBe("accent");
    expect(barTone(0)).toBe("accent");
  });
});

describe("readoutTone", () => {
  it("returns failed at 90", () => {
    expect(readoutTone(90)).toBe("failed");
  });

  it("returns blocked at 70", () => {
    expect(readoutTone(70)).toBe("blocked");
    expect(readoutTone(89)).toBe("blocked");
  });

  it("returns done below 70", () => {
    expect(readoutTone(69)).toBe("done");
    expect(readoutTone(0)).toBe("done");
  });
});
