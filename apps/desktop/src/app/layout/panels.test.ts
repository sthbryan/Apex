import { describe, expect, it } from "vitest";
import { DOCK_PANELS, DOCK_PANEL_ORDER } from "./panels";

describe("DOCK_PANELS", () => {
  it("contains eight panels", () => {
    expect(Object.keys(DOCK_PANELS)).toHaveLength(8);
    expect(DOCK_PANEL_ORDER).toHaveLength(8);
  });

  it("order matches keys", () => {
    expect(DOCK_PANEL_ORDER).toEqual(Object.keys(DOCK_PANELS));
  });

  it("each entry has an icon and label", () => {
    for (const key of DOCK_PANEL_ORDER) {
      expect(DOCK_PANELS[key].icon).toBeDefined();
      expect(typeof DOCK_PANELS[key].label()).toBe("string");
    }
  });

  it("labels resolve to non-empty strings", () => {
    expect(DOCK_PANELS.sessions.label()).toBe("Sessions");
    expect(DOCK_PANELS.files.label()).toBe("Files");
    expect(DOCK_PANELS.git.label()).toBe("Changes");
  });
});
