import { beforeEach, describe, expect, it, vi } from "vitest";

const toggleSettings = vi.fn();
const toggleDock = vi.fn();
const toggleUsagePopover = vi.fn();
const splitWithShell = vi.fn();
const cycleLayout = vi.fn();
const closePane = vi.fn();
const findLeaf = vi.fn();

vi.mock("@/app/view", () => ({
  toggleSettings: (...args: unknown[]) => toggleSettings(...args),
}));

vi.mock("@/app/layout/state", () => ({
  toggleDock: (...args: unknown[]) => toggleDock(...args),
}));

vi.mock("@/features/sessions/pending", () => ({
  cycleLayout: (...args: unknown[]) => cycleLayout(...args),
  splitWithShell: (...args: unknown[]) => splitWithShell(...args),
}));

vi.mock("@/features/usage/state", () => ({
  toggleUsagePopover: (...args: unknown[]) => toggleUsagePopover(...args),
}));

vi.mock("@/features/workspace/state", () => ({
  activeTab: { value: null },
  closePane: (...args: unknown[]) => closePane(...args),
}));

vi.mock("@/features/workspace/tree", () => ({
  findLeaf: (...args: unknown[]) => findLeaf(...args),
}));

import { COMMANDS, run, useToggles } from "./commands";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useToggles and COMMANDS", () => {
  it("calls the palette toggle", () => {
    const togglePalette = vi.fn();
    const toggleFinder = vi.fn();
    useToggles({ togglePalette, toggleFinder });
    COMMANDS.palette();
    expect(togglePalette).toHaveBeenCalledOnce();
  });

  it("calls finder toggle", () => {
    const togglePalette = vi.fn();
    const toggleFinder = vi.fn();
    useToggles({ togglePalette, toggleFinder });
    COMMANDS.finder();
    expect(toggleFinder).toHaveBeenCalledOnce();
  });

  it("calls settings and shortcuts", () => {
    COMMANDS.settings();
    expect(toggleSettings).toHaveBeenCalledWith();
    COMMANDS.shortcuts();
    expect(toggleSettings).toHaveBeenCalledWith("shortcuts");
  });

  it("calls usage and dock", () => {
    COMMANDS.usage();
    expect(toggleUsagePopover).toHaveBeenCalledOnce();
    COMMANDS.dock();
    expect(toggleDock).toHaveBeenCalledOnce();
  });

  it("splits and cycles layout", () => {
    COMMANDS["split-right"]();
    expect(splitWithShell).toHaveBeenCalledWith("row");
    COMMANDS["split-down"]();
    expect(splitWithShell).toHaveBeenCalledWith("column");
    COMMANDS["cycle-layout"]();
    expect(cycleLayout).toHaveBeenCalledOnce();
  });

  it("run invokes a command by id", () => {
    const togglePalette = vi.fn();
    useToggles({ togglePalette, toggleFinder: vi.fn() });
    run("palette");
    expect(togglePalette).toHaveBeenCalledOnce();
  });

  it("run ignores unknown ids", () => {
    expect(() => run("unknown")).not.toThrow();
  });
});
