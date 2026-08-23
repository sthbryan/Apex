import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as StateModule from "./state";

const sendNotification = vi.fn();
const isPermissionGranted = vi.fn();
const requestPermission = vi.fn();
const onFocusChanged = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isFocused: () => Promise.resolve(true),
    onFocusChanged: (handler: (event: { payload: boolean }) => void) => {
      onFocusChanged(handler);
      return Promise.resolve(() => {});
    },
  }),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: (...args: unknown[]) => isPermissionGranted(...args),
  requestPermission: (...args: unknown[]) => requestPermission(...args),
  sendNotification: (...args: unknown[]) => sendNotification(...args),
}));

const { mocks, shared } = vi.hoisted(() => {
  type Box<T> = { value: T };
  function makeBox<T>(initial: T): Box<T> & { peek: () => T } {
    const box: Box<T> & { peek: () => T } = {
      value: initial,
      peek() {
        return box.value;
      },
    };
    return box;
  }
  const mutedSessions = makeBox<string[]>([]);
  const notifyEnabled = makeBox<boolean>(true);
  const visibleSessions = makeBox<Set<string>>(new Set());
  return {
    shared: { mutedSessions, notifyEnabled, visibleSessions },
    mocks: {
      projects: { value: [] as Array<{ id: string; name: string }> },
      sessions: {
        value: [] as Array<{
          id: string;
          project_id: string;
          title: string;
          task: string | null;
          state: string;
        }>,
      },
      onNotice: () => () => {},
      mutedSessions,
      notifyEnabled,
      visibleSessions,
    },
  };
});

vi.mock("@/features/projects/state", () => ({
  projects: mocks.projects,
}));

vi.mock("@/features/sessions/state", () => ({
  sessions: mocks.sessions,
  onNotice: mocks.onNotice,
}));

vi.mock("@/features/settings/agentMode", () => ({
  mutedSessions: mocks.mutedSessions,
  notifyEnabled: mocks.notifyEnabled,
}));

vi.mock("@/features/workspace/state", () => ({
  visibleSessions: mocks.visibleSessions,
}));

const metrics = vi.hoisted(() => ({ value: null }));
vi.mock("@/shared/telemetry", () => ({
  metrics,
}));

const toasts = vi.hoisted(() => ({ value: [] as Array<{ id: number; text: string }> }));
const complain = vi.hoisted(() => vi.fn());
vi.mock("@/shared/daemon", () => ({
  complain,
  notices: toasts,
}));

vi.mock("@/shared/i18n", () => ({
  t: (key: string, params?: Record<string, string>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

let mod: typeof StateModule;

function session(id: string, projectId: string, title = "s", task: string | null = null) {
  return { id, project_id: projectId, title, task, state: "idle" };
}

function project(id: string, name: string) {
  return { id, name };
}

beforeEach(async () => {
  vi.resetModules();
  mocks.projects.value = [];
  mocks.sessions.value = [];
  shared.mutedSessions.value = [];
  shared.notifyEnabled.value = true;
  shared.visibleSessions.value = new Set();
  metrics.value = null;
  toasts.value = [];
  sendNotification.mockReset();
  complain.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 0, 1).getTime());
  mod = await import("./state");
});

describe("lasting", () => {
  it("only errors are lasting", () => {
    expect(mod.lasting("error")).toBe(true);
    expect(mod.lasting("blocked")).toBe(false);
    expect(mod.lasting("done")).toBe(false);
    expect(mod.lasting("terminal")).toBe(false);
  });
});

describe("scopeOf", () => {
  it("returns the app name when no session matches", () => {
    expect(mod.scopeOf(null)).toBe("app.name");
  });

  it("returns session title when project is unknown", () => {
    mocks.sessions.value = [session("s1", "p1", "Title")];
    mocks.projects.value = [];
    expect(mod.scopeOf("s1")).toBe("Title");
  });

  it("prefixes with the project name", () => {
    mocks.sessions.value = [session("s1", "p1", "Title")];
    mocks.projects.value = [project("p1", "Apex")];
    expect(mod.scopeOf("s1")).toBe("Apex · Title");
  });
});

describe("unread", () => {
  it("counts only unread notices", () => {
    mod.notices.value = [
      { id: 1, sessionId: null, kind: "done", title: "a", body: "", at: 0, read: false },
      { id: 2, sessionId: null, kind: "done", title: "b", body: "", at: 0, read: true },
      { id: 3, sessionId: null, kind: "done", title: "c", body: "", at: 0, read: false },
    ];
    expect(mod.unread.value).toBe(2);
  });
});

describe("waiting", () => {
  it("filters blocked sessions", () => {
    const base = session("s2", "p1");
    const done = session("s3", "p1");
    mocks.sessions.value = [
      session("s1", "p1"),
      { ...base, state: "blocked" },
      { ...done, state: "done" },
    ];
    expect(mod.waiting.value.map((s) => s.id)).toEqual(["s2"]);
  });
});

describe("push + shouldToast", () => {
  it("never toasts quiet notices", () => {
    mod.push({ sessionId: null, kind: "quiet", title: "t", body: "b" });
    expect(mod.live.value).toHaveLength(0);
  });

  it("toasts untargeted notices", () => {
    mod.push({ sessionId: null, kind: "done", title: "t", body: "b" });
    expect(mod.live.value).toHaveLength(1);
  });

  it("skips toasts for muted sessions", () => {
    shared.mutedSessions.value = ["s1"];
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    expect(mod.live.value).toHaveLength(0);
  });

  it("skips toasts when the session is focused", () => {
    shared.visibleSessions.value = new Set(["s1"]);
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    expect(mod.live.value).toHaveLength(0);
  });

  it("toasts when the session is not focused", () => {
    shared.visibleSessions.value = new Set(["other"]);
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    expect(mod.live.value).toHaveLength(1);
  });

  it("errors do not auto-dismiss on schedule", () => {
    mod.push({ sessionId: null, kind: "error", title: "t", body: "b" });
    expect(mod.live.value).toHaveLength(1);
    vi.advanceTimersByTime(10_000);
    expect(mod.live.value).toHaveLength(1);
  });

  it("non-error toasts auto-dismiss after the timeout", () => {
    mod.push({ sessionId: null, kind: "done", title: "t", body: "b" });
    expect(mod.live.value).toHaveLength(1);
    vi.advanceTimersByTime(7_000);
    expect(mod.live.value).toHaveLength(0);
  });
});

describe("dismissToast", () => {
  it("removes a single toast", () => {
    mod.push({ sessionId: null, kind: "done", title: "t", body: "b" });
    const id = mod.live.value[0];
    mod.dismissToast(id);
    expect(mod.live.value).toHaveLength(0);
  });
});

describe("markAllRead and forgetNotices", () => {
  it("marks everything read", () => {
    mod.notices.value = [
      { id: 1, sessionId: null, kind: "done", title: "a", body: "", at: 0, read: false },
    ];
    mod.markAllRead();
    expect(mod.notices.value.every((notice) => notice.read)).toBe(true);
  });

  it("clears the list", () => {
    mod.notices.value = [
      { id: 1, sessionId: null, kind: "done", title: "a", body: "", at: 0, read: false },
    ];
    mod.forgetNotices();
    expect(mod.notices.value).toHaveLength(0);
  });
});

describe("push + shouldDisturb", () => {
  it("does not disturb when permission is missing", () => {
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("does not disturb when the kill switch is off", () => {
    shared.notifyEnabled.value = false;
    mod.permitted.value = true;
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("does not disturb quiet notices", () => {
    mod.permitted.value = true;
    mod.push({ sessionId: null, kind: "quiet", title: "t", body: "b" });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("disturbs untargeted notices", () => {
    mod.permitted.value = true;
    mod.push({ sessionId: null, kind: "done", title: "t", body: "b" });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("does not disturb muted sessions", () => {
    mod.permitted.value = true;
    shared.mutedSessions.value = ["s1"];
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("does not disturb a focused session", () => {
    mod.permitted.value = true;
    shared.visibleSessions.value = new Set(["s1"]);
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("cooldown dedupes repeated notifications on the same session (sentRecently)", () => {
    mod.permitted.value = true;
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("does not dedupe across different sessions", () => {
    mod.permitted.value = true;
    mod.push({ sessionId: "s1", kind: "done", title: "t", body: "b" });
    mod.push({ sessionId: "s2", kind: "done", title: "t", body: "b" });
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });
});
