import { beforeEach, describe, expect, it, vi } from "vitest";
import { drain, forget, queue, queued, queuedIn, unqueue } from "@/features/acp/state";

const invoke = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

beforeEach(() => {
  queued.value = {};
  invoke.mockClear();
});

describe("holding on to what you typed while the agent works", () => {
  it("keeps them in the order they were typed, per session", () => {
    queue("one", "primero");
    queue("one", "segundo");
    queue("two", "de la otra");

    expect(queuedIn("one")).toEqual(["primero", "segundo"]);
    expect(queuedIn("two")).toEqual(["de la otra"]);
  });

  it("lets one be taken back out without disturbing the rest", () => {
    queue("one", "primero");
    queue("one", "segundo");
    queue("one", "tercero");

    unqueue("one", 1);
    expect(queuedIn("one")).toEqual(["primero", "tercero"]);
  });

  it("sends one at a time and leaves the rest waiting", async () => {
    queue("one", "primero");
    queue("one", "segundo");

    await drain("one");
    expect(invoke).toHaveBeenCalledWith("acp_prompt", { id: "one", text: "primero" });
    expect(queuedIn("one")).toEqual(["segundo"]);

    await drain("one");
    expect(queuedIn("one")).toEqual([]);
  });

  it("does nothing when there is nothing waiting", async () => {
    await drain("one");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("drops what a closed session was holding", () => {
    queue("one", "primero");
    forget("one");
    expect(queuedIn("one")).toEqual([]);
  });
});
