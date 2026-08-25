import { describe, expect, it } from "vitest";
import { nextWidth } from "./SideResize";

describe("nextWidth", () => {
  it("grows a left panel when the pointer moves right", () => {
    expect(nextWidth("left", 200, 300, 340)).toBe(240);
  });

  it("shrinks a left panel when the pointer moves left", () => {
    expect(nextWidth("left", 200, 300, 260)).toBe(160);
  });

  it("grows a right panel when the pointer moves left", () => {
    expect(nextWidth("right", 200, 300, 260)).toBe(240);
  });

  it("shrinks a right panel when the pointer moves right", () => {
    expect(nextWidth("right", 200, 300, 340)).toBe(160);
  });

  it("holds the width when the pointer does not move", () => {
    expect(nextWidth("left", 200, 300, 300)).toBe(200);
    expect(nextWidth("right", 200, 300, 300)).toBe(200);
  });
});
