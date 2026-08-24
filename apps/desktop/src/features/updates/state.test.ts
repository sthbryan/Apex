import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as StateModule from "./state";

const check = vi.fn();
const relaunch = vi.fn();
const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => relaunch(...args),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => check(...args),
}));

type Progress = { event: string; data?: { contentLength?: number; chunkLength?: number } };

function waiting() {
  return {
    version: "9.9.9",
    body: "notes",
    download: vi.fn(async (report: (event: Progress) => void) => {
      report({ event: "Started", data: { contentLength: 100 } });
      report({ event: "Progress", data: { chunkLength: 50 } });
      report({ event: "Finished" });
    }),
    install: vi.fn(async () => {}),
  };
}

let state: typeof StateModule;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  invoke.mockResolvedValue(true);
  state = await import("./state");
});

describe("looking for an update", () => {
  it("settles on current when nothing is waiting", async () => {
    check.mockResolvedValue(null);

    await expect(state.lookForUpdate()).resolves.toBe(false);
    expect(state.stage.value).toBe("current");
    expect(state.offered.value).toBeNull();
  });

  it("holds on to the offer when one is waiting", async () => {
    check.mockResolvedValue(waiting());

    await expect(state.lookForUpdate()).resolves.toBe(true);
    expect(state.stage.value).toBe("found");
    expect(state.offered.value).toEqual({ version: "9.9.9", notes: "notes" });
  });

  it("reports a check it could not finish", async () => {
    check.mockRejectedValue(new Error("offline"));

    await expect(state.lookForUpdate()).resolves.toBe(false);
    expect(state.stage.value).toBe("failed");
    expect(state.failure.value).toContain("offline");
  });
});

describe("installs that cannot patch themselves", () => {
  it("points at the release page instead of downloading", async () => {
    const update = waiting();
    check.mockResolvedValue(update);
    invoke.mockImplementation((command: string) =>
      command === "self_updating" ? Promise.resolve(false) : Promise.resolve(undefined),
    );

    await state.lookForUpdate();
    expect(state.stage.value).toBe("manual");

    await state.fetchUpdate();
    expect(update.download).not.toHaveBeenCalled();
    expect(state.stage.value).toBe("manual");
  });

  it("hands the release page to the system browser", async () => {
    await state.openReleases();

    expect(invoke).toHaveBeenCalledWith("open_url", {
      url: "https://github.com/sthbryan/Apex/releases/latest",
    });
  });
});

describe("taking the update", () => {
  it("walks the download through to ready", async () => {
    check.mockResolvedValue(waiting());
    await state.lookForUpdate();

    await state.fetchUpdate();

    expect(state.progress.value).toBe(1);
    expect(state.stage.value).toBe("ready");
  });

  it("restarts once the bundle is in place", async () => {
    const update = waiting();
    check.mockResolvedValue(update);
    await state.lookForUpdate();
    await state.fetchUpdate();

    await state.applyUpdate();

    expect(update.install).toHaveBeenCalled();
    expect(relaunch).toHaveBeenCalled();
  });

  it("refuses to restart before the bundle is down", async () => {
    const update = waiting();
    check.mockResolvedValue(update);
    await state.lookForUpdate();

    await state.applyUpdate();

    expect(update.install).not.toHaveBeenCalled();
    expect(relaunch).not.toHaveBeenCalled();
  });
});

describe("the check at launch", () => {
  it("pulls the bundle down on its own", async () => {
    check.mockResolvedValue(waiting());

    await state.watchForUpdates();

    expect(state.stage.value).toBe("ready");
  });

  it("waits for you when the setting is off", async () => {
    const update = waiting();
    check.mockResolvedValue(update);
    state.setAutoUpdate(false);

    await state.watchForUpdates();

    expect(update.download).not.toHaveBeenCalled();
    expect(state.stage.value).toBe("found");
  });

  it("stays quiet when it cannot reach the server", async () => {
    check.mockRejectedValue(new Error("offline"));

    await state.watchForUpdates();

    expect(state.stage.value).toBe("idle");
    expect(state.failure.value).toBeNull();
  });
});
