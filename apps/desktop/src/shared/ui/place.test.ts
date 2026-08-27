import { clippedRoom, opensLeftward, opensUpward } from "@apex/ui";
import { describe, expect, it } from "vitest";

function trigger(top: number, bottom: number) {
  return { getBoundingClientRect: () => ({ top, bottom }) };
}

describe("opensUpward", () => {
  it("opens downward when there is room below", () => {
    expect(opensUpward(trigger(100, 130), 4, 800)).toBe(false);
  });

  it("opens upward when the trigger sits at the bottom", () => {
    expect(opensUpward(trigger(760, 790), 4, 800)).toBe(true);
  });

  it("stays downward when below is cramped but still the roomier side", () => {
    expect(opensUpward(trigger(20, 50), 20, 200)).toBe(false);
  });

  it("needs less room for a short list", () => {
    expect(opensUpward(trigger(700, 730), 1, 800)).toBe(false);
    expect(opensUpward(trigger(700, 730), 8, 800)).toBe(true);
  });

  it("never flips a list it cannot measure", () => {
    expect(opensUpward(null, 8, 800)).toBe(false);
  });

  it("caps how much room a very long list asks for", () => {
    expect(opensUpward(trigger(300, 330), 200, 800)).toBe(false);
  });
});

describe("clippedRoom", () => {
  function nest(overflow: string, bottom: number) {
    const outer = document.createElement("div");
    outer.style.overflowX = overflow;
    outer.style.overflowY = overflow;
    outer.getBoundingClientRect = () => ({ bottom }) as DOMRect;
    const inner = document.createElement("span");
    outer.appendChild(inner);
    document.body.appendChild(outer);
    return inner;
  }

  it("stops at the first ancestor that clips", () => {
    expect(clippedRoom(nest("hidden", 500), 800)).toBe(500);
  });

  it("walks past ancestors that let it through", () => {
    expect(clippedRoom(nest("visible", 500), 800)).toBe(800);
  });

  it("never claims more room than the window has", () => {
    expect(clippedRoom(nest("hidden", 900), 800)).toBe(800);
  });

  it("falls back when there is nothing to measure", () => {
    expect(clippedRoom(null, 800)).toBe(800);
  });
});

describe("opensLeftward", () => {
  function trigger(left: number, right: number) {
    return { getBoundingClientRect: () => ({ left, right }) };
  }

  it("grows rightward from a trigger on the left", () => {
    expect(opensLeftward(trigger(10, 150), 900)).toBe(false);
  });

  it("grows leftward from a trigger on the right", () => {
    expect(opensLeftward(trigger(750, 890), 900)).toBe(true);
  });

  it("never flips one it cannot measure", () => {
    expect(opensLeftward(null, 900)).toBe(false);
  });
});
