import { describe, expect, it } from "vitest";
import { keepWindow, readFrames } from "@/shared/perfStats";

describe("reading frames", () => {
  it("says nothing when no frame has been drawn", () => {
    expect(readFrames([])).toEqual({ fps: 0, low: 0 });
  });

  it("turns a steady sixteen millisecond frame into sixty", () => {
    expect(readFrames(Array(60).fill(16.667)).fps).toBe(60);
  });

  it("keeps the average high while calling out the one frame that stalled", () => {
    const steady = Array(59).fill(16.667);

    const { fps, low } = readFrames([...steady, 100]);

    expect(fps).toBeGreaterThan(40);
    expect(low).toBe(10);
  });

  it("ignores frames that took no time at all", () => {
    expect(readFrames([0, 0, 20]).fps).toBe(50);
  });
});

describe("the rolling window", () => {
  it("keeps just enough frames to cover the window", () => {
    expect(keepWindow(Array(200).fill(10), 1000).length).toBe(100);
  });

  it("keeps everything when there is not a full window yet", () => {
    expect(keepWindow([10, 10, 10], 1000).length).toBe(3);
  });

  it("drops the oldest frames, not the newest", () => {
    expect(keepWindow([999, 1, 2, 3], 5)).toEqual([2, 3]);
  });
});
