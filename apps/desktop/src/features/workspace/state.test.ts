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
  reconcileDock: vi.fn(),
  returnPanelToDock: vi.fn(),
}));

import type { GitTarget } from "@/bindings/GitTarget";
import {
  activeCommit,
  activeSessionId,
  activeTab,
  activeTabId,
  clearWorkspace,
  closePane,
  closePanelViews,
  closeTab,
  closeViews,
  dropSession,
  extractLeafToTab,
  focusLeaf,
  focusSession,
  homeAsk,
  homeOpen,
  homeRacing,
  mergeTabInto,
  openDiff,
  openFile,
  openHome,
  openHomeRacing,
  openInNewTab,
  openPanel,
  openQuietly,
  panelIdsInWorkspace,
  resizeSplit,
  restoreLayout,
  serializeLayout,
  splitActive,
  swapPaneWithSibling,
  tabs,
  visibleSessions,
  whenClosingSession,
} from "./state";
import type { PaneNode, PaneView } from "./tree";
import { leaf, leaves, splitLeaf, stack } from "./tree";

beforeEach(() => {
  tabs.value = [];
  activeTabId.value = null;
  homeOpen.value = true;
  homeAsk.value = 0;
  localStorage.clear();
});

function viewOf(node: PaneNode): PaneView {
  if (node.kind !== "leaf") {
    throw new Error("expected a leaf, got a split");
  }
  return node.view;
}

function splitOf(node: PaneNode): Extract<PaneNode, { kind: "split" }> {
  if (node.kind !== "split") {
    throw new Error("expected a split, got a leaf");
  }
  return node;
}

describe("openHome", () => {
  it("opens home and bumps ask", () => {
    homeOpen.value = false;
    openHome();
    expect(homeOpen.value).toBe(true);
    expect(homeAsk.value).toBe(1);
    expect(homeRacing.value).toBe(false);
  });

  it("asks for race mode only through its own door", () => {
    openHomeRacing();
    expect(homeRacing.value).toBe(true);
    expect(homeAsk.value).toBe(1);
    openHome();
    expect(homeRacing.value).toBe(false);
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

  it("drops browser panes saved by an older layout", () => {
    const kept = leaf({ type: "session", sessionId: "a" });
    const gone = leaf({ type: "browser", url: "http://localhost:3000" });
    tabs.value = [{ id: "t1", root: stack([kept, gone], "row"), activeLeafId: gone.id }];
    activeTabId.value = "t1";
    const raw = serializeLayout();
    restoreLayout(raw, new Set(["a"]));
    expect(tabs.value).toHaveLength(1);
    expect(leaves(tabs.value[0].root)).toHaveLength(1);
    expect(tabs.value[0].root.kind).toBe("leaf");
    expect(tabs.value[0].activeLeafId).toBe(kept.id);
  });

  it("drops a tab that only held a browser pane", () => {
    const root = leaf({ type: "browser", url: "http://localhost:3000" });
    tabs.value = [{ id: "t1", root, activeLeafId: root.id }];
    activeTabId.value = "t1";
    const raw = serializeLayout();
    restoreLayout(raw, new Set([]));
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

describe("computed signals", () => {
  it("returns null activeTab when no tabs", () => {
    expect(activeTab.value).toBeNull();
  });

  it("returns null activeSessionId when no tabs", () => {
    expect(activeSessionId.value).toBeNull();
  });

  it("returns null activeCommit when no tabs", () => {
    expect(activeCommit.value).toBeNull();
  });

  it("visibleSessions collects sessions from the active tab", () => {
    const a = leaf({ type: "session", sessionId: "a" });
    const b = leaf({ type: "session", sessionId: "b" });
    tabs.value = [{ id: "t1", root: splitLeaf(a, a.id, "row", b), activeLeafId: a.id }];
    activeTabId.value = "t1";
    expect(visibleSessions.value).toEqual(new Set(["a", "b"]));
  });
});

describe("openPanel", () => {
  it("focuses an existing panel view", () => {
    const panel = leaf({ type: "panel", panel: "sessions" });
    tabs.value = [{ id: "t1", root: panel, activeLeafId: panel.id }];
    activeTabId.value = "t1";
    openPanel("sessions");
    expect(activeTabId.value).toBe("t1");
    expect(tabs.value[0].activeLeafId).toBe(panel.id);
  });

  it("opens a new panel when none exists", () => {
    tabs.value = [];
    openPanel("files");
    expect(tabs.value).toHaveLength(1);
    expect(tabs.value[0].root.kind).toBe("leaf");
    expect(viewOf(tabs.value[0].root)).toEqual({ type: "panel", panel: "files" });
  });
});

describe("closePanelViews", () => {
  it("removes every panel view of the requested kind", () => {
    const a = leaf({ type: "panel", panel: "sessions" });
    const b = leaf({ type: "panel", panel: "files" });
    tabs.value = [
      { id: "t1", root: a, activeLeafId: a.id },
      { id: "t2", root: b, activeLeafId: b.id },
    ];
    closePanelViews("sessions");
    expect(tabs.value).toHaveLength(1);
    expect(viewOf(tabs.value[0].root)).toEqual({ type: "panel", panel: "files" });
  });
});

describe("closeViews", () => {
  it("closes matching views across tabs", () => {
    const a = leaf({ type: "session", sessionId: "a" });
    const b = leaf({ type: "session", sessionId: "a" });
    tabs.value = [
      { id: "t1", root: a, activeLeafId: a.id },
      { id: "t2", root: b, activeLeafId: b.id },
    ];
    closeViews((view) => view.type === "session" && view.sessionId === "a");
    expect(tabs.value).toHaveLength(0);
  });
});

describe("openInNewTab", () => {
  it("opens a session view in a new tab", () => {
    tabs.value = [];
    openInNewTab({
      id: "s1",
      title: "S",
      state: "idle",
      task: null,
      parent: null,
      exit_code: null,
      started_at: 0,
      worktree: null,
    } as never);
    expect(tabs.value).toHaveLength(1);
    expect(viewOf(tabs.value[0].root)).toEqual({ type: "session", sessionId: "s1" });
    expect(activeTabId.value).toBe(tabs.value[0].id);
  });
});

describe("openBeside variants", () => {
  it("reuses an existing diff view", () => {
    const target = { type: "project" } as GitTarget;
    const diff = leaf({ type: "diff", target, path: "a.ts", commit: null });
    tabs.value = [{ id: "t1", root: diff, activeLeafId: diff.id }];
    activeTabId.value = "t1";
    openDiff(target, "a.ts");
    expect(tabs.value).toHaveLength(1);
    expect(tabs.value[0].activeLeafId).toBe(diff.id);
  });

  it("splits when there is no matching view", () => {
    const session = leaf({ type: "session", sessionId: "s1" });
    tabs.value = [{ id: "t1", root: session, activeLeafId: session.id }];
    activeTabId.value = "t1";
    openFile("a.ts");
    expect(tabs.value).toHaveLength(1);
    expect(tabs.value[0].root.kind).toBe("split");
  });
});

describe("splitActive", () => {
  it("opens a new tab when there is no active tab", () => {
    splitActive({ type: "session", sessionId: "s1" }, "row");
    expect(tabs.value).toHaveLength(1);
    expect(activeTabId.value).toBe(tabs.value[0].id);
  });

  it("splits the active leaf in the active tab", () => {
    const a = leaf({ type: "session", sessionId: "s1" });
    tabs.value = [{ id: "t1", root: a, activeLeafId: a.id }];
    activeTabId.value = "t1";
    splitActive({ type: "session", sessionId: "s2" }, "column");
    expect(tabs.value).toHaveLength(1);
    expect(tabs.value[0].root.kind).toBe("split");
    expect(splitOf(tabs.value[0].root).direction).toBe("column");
    expect(tabs.value[0].activeLeafId).not.toBe(a.id);
  });
});

describe("focusSession", () => {
  it("focuses the tab that owns the session", () => {
    const a = leaf({ type: "session", sessionId: "s1" });
    tabs.value = [{ id: "t1", root: a, activeLeafId: a.id }];
    activeTabId.value = null;
    const focused = focusSession("s1");
    expect(focused).toBe(true);
    expect(activeTabId.value).toBe("t1");
    expect(tabs.value[0].activeLeafId).toBe(a.id);
  });

  it("returns false when the session is absent", () => {
    expect(focusSession("nope")).toBe(false);
  });
});

describe("swapPaneWithSibling", () => {
  it("swaps views with its direct sibling", () => {
    const a = leaf({ type: "session", sessionId: "a" });
    const b = leaf({ type: "session", sessionId: "b" });
    const root = splitLeaf(a, a.id, "row", b);
    tabs.value = [{ id: "t1", root, activeLeafId: a.id }];
    swapPaneWithSibling("t1", a.id);
    const views =
      tabs.value[0].root.kind === "split"
        ? [viewOf(splitOf(tabs.value[0].root).first), viewOf(splitOf(tabs.value[0].root).second)]
        : [viewOf(tabs.value[0].root)];
    expect(views).toEqual([
      { type: "session", sessionId: "b" },
      { type: "session", sessionId: "a" },
    ]);
  });
});

describe("extractLeafToTab", () => {
  it("moves a pane into its own tab", () => {
    const a = leaf({ type: "session", sessionId: "a" });
    const b = leaf({ type: "session", sessionId: "b" });
    const root = splitLeaf(a, a.id, "row", b);
    tabs.value = [{ id: "t1", root, activeLeafId: a.id }];
    extractLeafToTab("t1", a.id);
    expect(tabs.value).toHaveLength(2);
    expect(activeTabId.value).not.toBe("t1");
  });
});

describe("mergeTabInto", () => {
  it("merges the active pane of the source into the target", () => {
    const a = leaf({ type: "session", sessionId: "a" });
    const b = leaf({ type: "session", sessionId: "b" });
    tabs.value = [
      { id: "t1", root: a, activeLeafId: a.id },
      { id: "t2", root: b, activeLeafId: b.id },
    ];
    activeTabId.value = "t2";
    mergeTabInto("t1", "t2");
    expect(tabs.value).toHaveLength(1);
    expect(tabs.value[0].id).toBe("t2");
    expect(tabs.value[0].root.kind).toBe("split");
  });
});

describe("dropSession", () => {
  it("closes every pane that hosts the session", () => {
    const a = leaf({ type: "session", sessionId: "a" });
    const b = leaf({ type: "session", sessionId: "b" });
    tabs.value = [
      { id: "t1", root: a, activeLeafId: a.id },
      { id: "t2", root: b, activeLeafId: b.id },
    ];
    dropSession("a");
    expect(tabs.value).toHaveLength(1);
    expect(tabs.value[0].id).toBe("t2");
  });
});

describe("closePane", () => {
  it("removes the last pane and closes the tab", () => {
    const only = leaf({ type: "session", sessionId: "a" });
    tabs.value = [{ id: "t1", root: only, activeLeafId: only.id }];
    activeTabId.value = "t1";
    closePane("t1", only, false);
    expect(tabs.value).toHaveLength(0);
    expect(activeTabId.value).toBeNull();
  });

  it("terminates the session when requested", () => {
    let closed: string | null = null;
    whenClosingSession((sessionId) => {
      closed = sessionId;
    });
    const only = leaf({ type: "session", sessionId: "a" });
    tabs.value = [{ id: "t1", root: only, activeLeafId: only.id }];
    activeTabId.value = "t1";
    closePane("t1", only, true);
    expect(closed).toBe("a");
  });

  it("restores a panel view to the dock", () => {
    const panel = leaf({ type: "panel", panel: "sessions" });
    tabs.value = [{ id: "t1", root: panel, activeLeafId: panel.id }];
    activeTabId.value = "t1";
    closePane("t1", panel, false);
    expect(tabs.value).toHaveLength(0);
  });
});

describe("closeTab", () => {
  it("returns panels to the dock on close", () => {
    const panel = leaf({ type: "panel", panel: "sessions" });
    tabs.value = [{ id: "t1", root: panel, activeLeafId: panel.id }];
    activeTabId.value = "t1";
    closeTab("t1");
    expect(tabs.value).toHaveLength(0);
  });
});

describe("focusLeaf", () => {
  it("switches active tab and leaf", () => {
    const a = leaf({ type: "session", sessionId: "a" });
    const b = leaf({ type: "session", sessionId: "b" });
    tabs.value = [
      { id: "t1", root: a, activeLeafId: a.id },
      { id: "t2", root: b, activeLeafId: b.id },
    ];
    activeTabId.value = "t1";
    focusLeaf("t2", b.id);
    expect(activeTabId.value).toBe("t2");
    expect(tabs.value[1].activeLeafId).toBe(b.id);
  });
});

describe("resizeSplit", () => {
  it("updates the ratio of the split", () => {
    const a = leaf({ type: "session", sessionId: "a" });
    const root = splitLeaf(a, a.id, "row", leaf({ type: "session", sessionId: "b" }));
    tabs.value = [{ id: "t1", root, activeLeafId: a.id }];
    resizeSplit("t1", root.id, 0.8);
    expect((tabs.value[0].root as { ratio: number }).ratio).toBe(0.8);
  });
});

describe("openQuietly", () => {
  it("splits the active tab when asSplit is true", () => {
    const a = leaf({ type: "session", sessionId: "a" });
    tabs.value = [{ id: "t1", root: a, activeLeafId: a.id }];
    activeTabId.value = "t1";
    openQuietly({ type: "session", sessionId: "b" }, true);
    expect(tabs.value).toHaveLength(1);
    expect(tabs.value[0].root.kind).toBe("split");
  });
});
