import { beforeEach, describe, expect, it } from "vitest";
import {
  dockMode,
  dockOrder,
  dockPanel,
  dockWidth,
  isDockPanel,
  moveDockPanel,
  placePanelInDock,
  reconcileDock,
  removePanelFromDock,
  resetDockWidth,
  setDockMode,
  setDockPanel,
  setDockWidth,
  toggleDock,
} from "./state";

beforeEach(() => {
  localStorage.clear();
  dockOrder.value = ["sessions", "files", "git", "review", "race", "history", "context", "tasks"];
  dockPanel.value = "sessions";
});

describe("isDockPanel", () => {
  it("recognizes known panels", () => {
    expect(isDockPanel("sessions")).toBe(true);
    expect(isDockPanel("tasks")).toBe(true);
  });

  it("rejects unknown ids", () => {
    expect(isDockPanel("unknown")).toBe(false);
    expect(isDockPanel("")).toBe(false);
  });
});

describe("setDockPanel", () => {
  it("sets the active panel when it is docked", () => {
    setDockPanel("git");
    expect(dockPanel.value).toBe("git");
  });

  it("ignores panels not in the dock", () => {
    removePanelFromDock("git");
    setDockPanel("git");
    expect(dockPanel.value).not.toBe("git");
  });
});

describe("moveDockPanel", () => {
  it("moves a panel by delta", () => {
    moveDockPanel("sessions", 1);
    expect(dockOrder.value[1]).toBe("sessions");
  });

  it("ignores out of bounds moves", () => {
    const before = [...dockOrder.value];
    moveDockPanel("sessions", -1);
    expect(dockOrder.value).toEqual(before);
    moveDockPanel("tasks", 1);
    expect(dockOrder.value).toEqual(before);
  });
});

describe("placePanelInDock", () => {
  it("places a panel at the end when no before is given", () => {
    removePanelFromDock("git");
    placePanelInDock("git");
    expect(dockOrder.value.at(-1)).toBe("git");
    expect(dockPanel.value).toBe("git");
  });

  it("places a panel before another", () => {
    placePanelInDock("tasks", "sessions");
    expect(dockOrder.value[0]).toBe("tasks");
  });
});

describe("removePanelFromDock", () => {
  it("removes the panel", () => {
    removePanelFromDock("git");
    expect(dockOrder.value.includes("git")).toBe(false);
  });

  it("reassigns active panel when removing it", () => {
    dockPanel.value = "git";
    removePanelFromDock("git");
    expect(dockPanel.value).not.toBe("git");
  });
});

describe("reconcileDock", () => {
  it("restores missing panels not claimed elsewhere", () => {
    dockOrder.value = ["sessions"];
    reconcileDock(["files"]);
    expect(dockOrder.value.includes("git")).toBe(true);
    expect(dockOrder.value.includes("tasks")).toBe(true);
  });

  it("does not duplicate when all panels are present", () => {
    const before = [...dockOrder.value];
    reconcileDock([]);
    expect(dockOrder.value).toEqual(before);
  });
});

describe("setDockWidth", () => {
  it("clamps to min and max", () => {
    setDockWidth(100);
    expect(dockWidth.value).toBeGreaterThanOrEqual(192);
    setDockWidth(1000);
    expect(dockWidth.value).toBeLessThanOrEqual(480);
  });

  it("respects window width", () => {
    Object.defineProperty(window, "innerWidth", { value: 400, configurable: true });
    setDockWidth(300);
    expect(dockWidth.value).toBeLessThanOrEqual(120);
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
  });

  it("resets to default", () => {
    setDockWidth(400);
    resetDockWidth();
    expect(dockWidth.value).toBe(224);
  });
});

describe("dockMode", () => {
  it("toggles between expanded and rail", () => {
    setDockMode("expanded");
    toggleDock();
    expect(dockMode.value).toBe("rail");
    toggleDock();
    expect(dockMode.value).toBe("expanded");
  });
});
