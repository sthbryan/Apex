import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AcpEntry } from "@/bindings/AcpEntry";

const playSound = vi.fn();

vi.mock("cuelume", () => ({
  play: (...args: unknown[]) => playSound(...args),
}));

import { absorb, transcripts } from "./state";

function tool(status: "running" | "failed"): AcpEntry {
  return {
    index: 0,
    at: 0,
    body: {
      type: "tool",
      call: {
        call_id: "call-1",
        title: "Run",
        kind: "shell",
        status,
        text: "",
        diffs: [],
        locations: [],
      },
    },
  };
}

beforeEach(() => {
  transcripts.value = {};
  playSound.mockReset();
});

describe("ACP tool sounds", () => {
  it("plays error when a tool fails", () => {
    absorb("s1", tool("failed"));

    expect(playSound).toHaveBeenCalledWith("error");
  });

  it("does not repeat error for the same failed state", () => {
    absorb("s1", tool("failed"));
    absorb("s1", tool("failed"));

    expect(playSound).toHaveBeenCalledTimes(1);
  });
});
