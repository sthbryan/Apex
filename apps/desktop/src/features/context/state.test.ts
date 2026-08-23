import { signal } from "@preact/signals";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@/features/projects/state", () => ({
  activeProjectId: signal(null),
}));

import { activeProjectId } from "@/features/projects/state";
import { entries, failure, loadContext, readEntry, writeEntry } from "./state";

beforeEach(() => {
  invoke.mockReset();
  entries.value = [];
  failure.value = null;
  (activeProjectId as unknown as { value: string | null }).value = null;
});

describe("loadContext", () => {
  it("clears when no project", async () => {
    await loadContext();
    expect(entries.value).toEqual([]);
  });

  it("loads entries on success", async () => {
    (activeProjectId as unknown as { value: string | null }).value = "p1";
    invoke.mockResolvedValue([{ key: "a", bytes: 1, updated_at: 1 }]);
    await loadContext();
    expect(entries.value).toHaveLength(1);
    expect(failure.value).toBeNull();
  });

  it("clears and sets failure on error", async () => {
    (activeProjectId as unknown as { value: string | null }).value = "p1";
    invoke.mockRejectedValue(new Error("fail"));
    await loadContext();
    expect(entries.value).toEqual([]);
    expect(failure.value).toBe("Error: fail");
  });
});

describe("readEntry and writeEntry", () => {
  it("reads an entry", async () => {
    (activeProjectId as unknown as { value: string | null }).value = "p1";
    invoke.mockResolvedValue("hello");
    expect(await readEntry("k")).toBe("hello");
    expect(invoke).toHaveBeenCalledWith("context_read", { project: "p1", key: "k" });
  });

  it("writes and reloads", async () => {
    (activeProjectId as unknown as { value: string | null }).value = "p1";
    invoke.mockResolvedValue([]);
    await writeEntry("k", "v");
    expect(invoke).toHaveBeenCalledWith("context_write", {
      project: "p1",
      key: "k",
      contents: "v",
    });
  });
});
