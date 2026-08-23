import { beforeEach, describe, expect, it, vi } from "vitest";

const { mocks } = vi.hoisted(() => {
  const openDiff = vi.fn();
  const gitStatus = { value: { changes: [] } as never };
  return {
    mocks: {
      openDiff,
      gitStatus,
    },
  };
});

vi.mock("@/features/git/state", () => ({
  gitStatus: mocks.gitStatus,
  refreshGit: vi.fn(),
  sameTarget: () => false,
  selectTarget: () => {},
}));

vi.mock("@/features/workspace/state", () => ({
  openDiff: mocks.openDiff,
}));

import { stepReview, settleReview } from "./state";

beforeEach(() => {
  mocks.openDiff.mockReset();
  mocks.gitStatus.value.changes = [];
});

describe("stepReview", () => {
  it("moves cursor forward when path is found", () => {
    mocks.gitStatus.value.changes = [
      { path: "a.ts" },
      { path: "b.ts" },
      { path: "c.ts" },
    ];
    stepReview({ type: "project" } as never, "b.ts", 1);
    expect(mocks.openDiff).toHaveBeenCalledWith({ type: "project" }, "c.ts");
  });

  it("starts from 0 when path is not found", () => {
    mocks.gitStatus.value.changes = [{ path: "a.ts" }];
    stepReview({ type: "project" } as never, "nonexistent.ts", 1);
    expect(mocks.openDiff).toHaveBeenCalledWith({ type: "project" }, "a.ts");
  });
});

describe("settleReview", () => {
  it("sets cursor to the path when found", () => {
    mocks.gitStatus.value.changes = [{ path: "a.ts" }, { path: "b.ts" }];
    settleReview({ type: "project" } as never, "b.ts");
  });

  it("sets cursor to last file when path is not found", () => {
    mocks.gitStatus.value.changes = [{ path: "a.ts" }];
    settleReview({ type: "project" } as never, "nonexistent.ts");
    expect(mocks.openDiff).toHaveBeenCalledWith({ type: "project" }, "a.ts");
  });

  it("returns when files length is 0", () => {
    mocks.gitStatus.value.changes = [];
    settleReview({ type: "project" } as never, "any.ts");
    expect(mocks.openDiff).not.toHaveBeenCalled();
  });
});