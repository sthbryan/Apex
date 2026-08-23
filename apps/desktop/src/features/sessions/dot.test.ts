import { describe, expect, it } from "vitest";
import { stateOf } from "./dot";

describe("stateOf", () => {
  it("maps exit code 0 to done", () => {
    expect(stateOf({ exit_code: 0, state: "idle" } as never)).toBe("done");
  });

  it("maps non-zero exit to failed", () => {
    expect(stateOf({ exit_code: 1, state: "idle" } as never)).toBe("failed");
    expect(stateOf({ exit_code: 137, state: "working" } as never)).toBe("failed");
  });

  it("returns live states when not exited", () => {
    expect(stateOf({ exit_code: null, state: "working" } as never)).toBe("working");
    expect(stateOf({ exit_code: null, state: "blocked" } as never)).toBe("blocked");
    expect(stateOf({ exit_code: null, state: "done" } as never)).toBe("done");
    expect(stateOf({ exit_code: null, state: "idle" } as never)).toBe("idle");
  });

  it("falls back to idle for unknown states", () => {
    expect(stateOf({ exit_code: null, state: "unknown" } as never)).toBe("idle");
  });
});
