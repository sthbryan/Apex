import { createElement, type VNode } from "preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";

const { mocks } = vi.hoisted(() => {
  const commands = {
    palette: vi.fn(),
    finder: vi.fn(),
    settings: vi.fn(),
    shortcuts: vi.fn(),
    usage: vi.fn(),
    dock: vi.fn(),
    "cycle-layout": vi.fn(),
    "close-pane": vi.fn(),
  };
  return {
    mocks: {
      commands,
      splitWithShell: vi.fn(),
      tabs: { value: [] as Array<{ id: string }> },
      activeTabId: { value: null as string | null },
    },
  };
});

vi.mock("@/features/workspace/state", () => ({
  tabs: mocks.tabs,
  activeTabId: mocks.activeTabId,
}));

vi.mock("@/features/projects/state", () => ({
  projectSessions: { value: [] },
}));

vi.mock("@/features/git/state", () => ({
  gitStatus: { value: null },
}));

vi.mock("@/app/commands", () => ({
  COMMANDS: mocks.commands,
  useToggles: () => {},
}));

vi.mock("@/features/sessions/pending", () => ({
  splitWithShell: mocks.splitWithShell,
}));

vi.mock("@/app/layout/state", () => ({
  toggleDock: vi.fn(),
}));

vi.mock("@/app/view", () => ({
  toggleSettings: vi.fn(),
}));

vi.mock("@/features/usage/state", () => ({
  toggleUsagePopover: vi.fn(),
}));

vi.mock("@/features/workspace/tree", () => ({
  findLeaf: () => null,
}));

import type { Toggles } from "./commands";
import { SHORTCUTS, useKeymap } from "./keymap";

function KeymapTester(props: { toggles: Toggles }): VNode {
  useKeymap(props.toggles);
  return <div data-testid="probe" />;
}

function fireKeyboardEvent(key: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
}

describe("SHORTCUTS", () => {
  it("exposes the expected navigation shortcuts", () => {
    const ids = SHORTCUTS.filter((s) => s.group === "navigation").map((s) => s.id);
    expect(ids).toEqual(["palette", "finder", "shortcuts", "settings", "usage", "dock", "tab-1-9"]);
  });

  it("exposes the expected pane shortcuts", () => {
    const ids = SHORTCUTS.filter((s) => s.group === "panes").map((s) => s.id);
    expect(ids).toEqual([
      "split-right",
      "split-direction",
      "split-down",
      "cycle-layout",
      "close-pane",
    ]);
  });
});

describe("useKeymap", () => {
  const toggles: Toggles = {
    togglePalette: () => {},
    toggleFinder: () => {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tabs.value = [];
    mocks.activeTabId.value = null;
  });

  it("calls palette when cmd+k is pressed", () => {
    render(createElement(KeymapTester, { toggles }));
    window.dispatchEvent(fireKeyboardEvent("k", { metaKey: true }));
    expect(mocks.commands.palette).toHaveBeenCalledTimes(1);
  });

  it("calls finder when cmd+p is pressed", () => {
    render(createElement(KeymapTester, { toggles }));
    window.dispatchEvent(fireKeyboardEvent("p", { metaKey: true }));
    expect(mocks.commands.finder).toHaveBeenCalledTimes(1);
  });

  it("calls settings when cmd+, is pressed", () => {
    render(createElement(KeymapTester, { toggles }));
    window.dispatchEvent(fireKeyboardEvent(",", { metaKey: true }));
    expect(mocks.commands.settings).toHaveBeenCalledTimes(1);
  });

  it("ignores keys without cmd or ctrl", () => {
    render(createElement(KeymapTester, { toggles }));
    window.dispatchEvent(fireKeyboardEvent("k"));
    expect(mocks.commands.palette).not.toHaveBeenCalled();
  });

  it("switches to the tab the number points at", () => {
    mocks.tabs.value = [{ id: "first" }, { id: "second" }];
    render(createElement(KeymapTester, { toggles }));
    window.dispatchEvent(fireKeyboardEvent("2", { metaKey: true }));
    expect(mocks.activeTabId.value).toBe("second");
  });

  it("leaves the tab alone when the number points past the last one", () => {
    mocks.tabs.value = [{ id: "first" }];
    render(createElement(KeymapTester, { toggles }));
    window.dispatchEvent(fireKeyboardEvent("9", { metaKey: true }));
    expect(mocks.activeTabId.value).toBeNull();
  });
});
