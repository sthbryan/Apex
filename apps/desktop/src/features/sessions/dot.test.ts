import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { stateOf } from "./dot";

function session(fields: Partial<SessionSummary>): SessionSummary {
  return { state: "idle", exit_code: null, ...fields } as SessionSummary;
}

describe("stateOf", () => {
  it("calls a clean exit done and anything else failed", () => {
    expect(stateOf(session({ exit_code: 0, state: "working" }))).toBe("done");
    expect(stateOf(session({ exit_code: 1, state: "working" }))).toBe("failed");
    expect(stateOf(session({ exit_code: 130, state: "idle" }))).toBe("failed");
  });

  it("lets the exit code win over whatever the session last reported", () => {
    expect(stateOf(session({ exit_code: 0, state: "blocked" }))).toBe("done");
  });

  it("passes a live state through", () => {
    expect(stateOf(session({ state: "working" }))).toBe("working");
    expect(stateOf(session({ state: "blocked" }))).toBe("blocked");
  });

  it("falls back to idle for a state the ui does not know", () => {
    expect(stateOf(session({ state: "pondering" as SessionSummary["state"] }))).toBe("idle");
  });
});
