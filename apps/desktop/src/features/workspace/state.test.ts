import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/projects/state", () => ({
  sessions: { value: [] },
}));

vi.mock("@/features/git/state", () => ({
  gitTarget: { value: { type: "project" } },
  sameTarget: () => false,
  selectTarget: () => {},
}));

vi.mock("@/features/sessions/state", () => ({
  sessions: { value: [] },
}));

vi.mock("@/features/settings/agentMode", () => ({
  splitCaps: { value: { yours: 5, spare: 6 } },
}));

vi.mock("@/app/layout/state", () => ({
  reconcileDock: () => {},
  returnPanelToDock: () => {},
}));

import { leaf } from "./tree";
import {
  activeTabId,
  clearWorkspace,
  homeAsk,
  homeOpen,
  openHome,
  panelIdsInWorkspace,
  restoreLayout,
  serializeLayout,
  tabs,
} from "./state";

beforeEach(() => {
  tabs.value = [];
  activeTabId.value = null;
  homeOpen.value = true;
  homeAsk.value = 0;
  localStorage.clear();
});

describe("openHome", () => {
  it("opens home and bumps ask", () => {
    homeOpen.value = false;
    openHome();
    expect(homeOpen.value).toBe(true);
    expect(homeAsk.value).toBe(1);
  });
});

describe("clearWorkspace", () => {
  it("clears tabs and active id", () => {
    const root = leaf({ type: "session", sessionId: "a" });
    tabs.value = [{ id: "t1", root, activeLeafId: root.id }];
    activeTabId.value = "t1";
    clearWorkspace();
    expect(tabs.value).toHaveLength(0);
    expect(activeTabId.value).toBeNull();
  });
});

describe("serializeLayout and restoreLayout", () => {
  it("round-trips tabs", () => {
    const root = leaf({ type: "session", sessionId: "a" });
    tabs.value = [{ id: "t1", root, activeLeafId: root.id }];
    activeTabId.value = "t1";
    const raw = serializeLayout();
    tabs.value = [];
    activeTabId.value = null;
    restoreLayout(raw, new Set(["a"]));
    expect(tabs.value).toHaveLength(1);
    expect(activeTabId.value).toBe("t1");
  });

  it("drops tabs with dead sessions", () => {
    const root = leaf({ type: "session", sessionId: "dead" });
    tabs.value = [{ id: "t1", root, activeLeafId: root.id }];
    activeTabId.value = "t1";
    const raw = serializeLayout();
    restoreLayout(raw, new Set([]));
    expect(tabs.value).toHaveLength(0);
    expect(activeTabId.value).toBeNull();
  });

  it("handles null and invalid json", () => {
    restoreLayout(null, new Set([]));
    expect(tabs.value).toHaveLength(0);
    restoreLayout("not json", new Set([]));
    expect(tabs.value).toHaveLength(0);
  });

  it("keeps panels even when sessions are pruned", () => {
    const root = leaf({ type: "panel", panel: "sessions" });
    tabs.value = [{ id: "t1", root, activeLeafId: root.id }];
    activeTabId.value = "t1";
    const raw = serializeLayout();
    restoreLayout(raw, new Set([]));
    expect(tabs.value).toHaveLength(1);
  });
});

describe("panelIdsInWorkspace", () => {
  it("collects panel ids", () => {
    const a = leaf({ type: "panel", panel: "sessions" });
    const b = leaf({ type: "session", sessionId: "x" });
    tabs.value = [{ id: "t1", root: a, activeLeafId: a.id }];
    expect(panelIdsInWorkspace()).toEqual(["sessions"]);
    tabs.value = [{ id: "t1", root: b, activeLeafId: b.id }];
    expect(panelIdsInWorkspace()).toEqual([]);
  });
});
