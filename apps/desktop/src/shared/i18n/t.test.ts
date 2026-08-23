import { describe, expect, it } from "vitest";
import { t } from "./index";

describe("t", () => {
  it("returns the key when missing", () => {
    expect(t("missing.key" as never)).toBe("missing.key");
  });

  it("resolves a simple key", () => {
    expect(t("dock.sessions")).toBe("Sessions");
  });

  it("replaces params", () => {
    expect(t("projects.blocked", { count: "3" })).toBe("3 waiting");
    expect(t("git.branchSwitch", { branch: "main" })).toBe("Switch to main");
  });

  it("keeps placeholder when param is missing", () => {
    expect(t("projects.blocked")).toContain("{count}");
  });

  it("handles multiple params", () => {
    expect(t("race.keepAsk", { count: "2" })).toBe("Drop the other 2?");
  });
});
