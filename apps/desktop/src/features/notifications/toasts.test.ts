import { describe, expect, it } from "vitest";
import { soundFor } from "./Toasts";

describe("toast sounds", () => {
  it("uses error for problems that need attention", () => {
    expect(soundFor("error")).toBe("error");
    expect(soundFor("blocked")).toBe("error");
    expect(soundFor("quota")).toBe("error");
  });

  it("uses success for completed work", () => {
    expect(soundFor("done")).toBe("success");
  });

  it("uses loading for activity notices", () => {
    expect(soundFor("info")).toBe("loading");
    expect(soundFor("message")).toBe("loading");
  });
});
