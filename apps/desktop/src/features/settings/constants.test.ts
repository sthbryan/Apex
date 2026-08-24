import { describe, expect, it } from "vitest";
import {
  FROSTS,
  IDLE_GRACES,
  LANGUAGES,
  PANE_CAPS,
  THEMES,
  UI_SCALES,
  VEIL_AREAS,
} from "./constants";

describe("constants", () => {
  it("exposes themes", () => {
    expect(THEMES.map((t) => t.value)).toEqual(["system", "light", "dark"]);
  });

  it("exposes languages", () => {
    expect(LANGUAGES.map((l) => l.value)).toEqual(["en", "es"]);
  });

  it("defines pane caps and scales", () => {
    expect(PANE_CAPS).toContain(5);
    expect(UI_SCALES).toEqual(["compact", "normal", "roomy"]);
    expect(FROSTS).toEqual(["soft", "glare", "bright", "deep"]);
    expect(VEIL_AREAS).toEqual(["window", "sidebar"]);
  });

  it("defines idle graces", () => {
    expect(IDLE_GRACES.map((g) => g.value)).toEqual([0, 300, 18000]);
  });
});
