import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClosingModule from "./closing";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

async function load(): Promise<typeof ClosingModule> {
  vi.resetModules();
  return import("./closing");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("closing", () => {
  it("quits for good until told otherwise", async () => {
    const module = await load();

    expect(module.closing.value).toBe("quit");
  });

  it("remembers that you asked it to stay", async () => {
    localStorage.setItem("apex.closing", "tray");

    const module = await load();

    expect(module.closing.value).toBe("tray");
  });

  it("falls back to quitting when storage is unreadable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("no storage");
    });

    const module = await load();

    expect(module.closing.value).toBe("quit");
  });

  it("tells the shell to hold on when you pick the tray", async () => {
    const module = await load();

    module.setClosing("tray");

    expect(localStorage.getItem("apex.closing")).toBe("tray");
    expect(invoke).toHaveBeenCalledWith("set_keep_alive", { keep: true });
  });

  it("tells the shell to let go when you pick quit", async () => {
    localStorage.setItem("apex.closing", "tray");
    const module = await load();

    module.setClosing("quit");

    expect(localStorage.getItem("apex.closing")).toBe("quit");
    expect(invoke).toHaveBeenCalledWith("set_keep_alive", { keep: false });
  });

  it("repeats the stored choice at boot", async () => {
    localStorage.setItem("apex.closing", "tray");
    const module = await load();

    module.applyClosing();

    expect(invoke).toHaveBeenCalledWith("set_keep_alive", { keep: true });
  });
});
