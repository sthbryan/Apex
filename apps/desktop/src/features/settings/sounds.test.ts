import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as SoundsModule from "./sounds";

const setEnabled = vi.fn();
const play = vi.fn();

vi.mock("cuelume", () => ({
  bind: vi.fn(),
  play: (...args: unknown[]) => play(...args),
  setEnabled: (...args: unknown[]) => setEnabled(...args),
  setVolume: vi.fn(),
}));

async function load(): Promise<typeof SoundsModule> {
  vi.resetModules();
  return import("./sounds");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("interaction sounds", () => {
  it("starts enabled", async () => {
    const module = await load();

    expect(module.interactionSoundsEnabled.value).toBe(true);
    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("restores and persists the listener preference", async () => {
    localStorage.setItem("apex.interaction-sounds", "off");
    const module = await load();

    expect(module.interactionSoundsEnabled.value).toBe(false);

    module.setInteractionSoundsEnabled(true);

    expect(localStorage.getItem("apex.interaction-sounds")).toBe("on");
    expect(setEnabled).toHaveBeenLastCalledWith(true);
  });

  it("ticks when a settings search input changes", async () => {
    const module = await load();
    const root = document.createElement("div");
    const search = document.createElement("input");
    search.className = "ui-select-search";
    root.append(search);

    module.startSettingsSounds(root);
    search.dispatchEvent(new Event("input", { bubbles: true }));

    expect(play).toHaveBeenCalledWith("tick", { volume: 0.35 });
  });
});
