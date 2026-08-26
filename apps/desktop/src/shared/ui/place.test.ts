import { opensUpward } from "@apex/ui";
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
