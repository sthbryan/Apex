import { signal } from "@preact/signals";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const listen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listen(...args),
}));

vi.mock("@/features/projects/state", () => ({
  projectSessions: signal([] as { url: string | null }[]),
}));

vi.mock("@/features/settings/browsing", () => ({
  browsing: signal("internal"),
}));

vi.mock("@/shared/daemon", () => ({
  complain: () => {},
}));

import { asideOpen, asidePanel, closeAside } from "@/app/layout/state";
import { projectSessions } from "@/features/projects/state";
import { browsing } from "@/features/settings/browsing";
import { toolsOff } from "@/features/settings/toolGroups";
import { browserUrl, isLocal, openWeb, pickUrl, readWord, toggleBrowser } from "./state";

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue(undefined);
  (browsing as unknown as { value: string }).value = "internal";
  (projectSessions as unknown as { value: unknown[] }).value = [];
  browserUrl.value = null;
  toolsOff.value = [];
  closeAside();
  localStorage.clear();
});

describe("isLocal", () => {
  it("detects localhost variants", () => {
    expect(isLocal("http://localhost:3000")).toBe(true);
    expect(isLocal("http://127.0.0.1:8000")).toBe(true);
    expect(isLocal("http://0.0.0.0:80")).toBe(true);
    expect(isLocal("http://my.localhost/path")).toBe(true);
  });

  it("rejects external hosts", () => {
    expect(isLocal("https://example.com")).toBe(false);
    expect(isLocal("https://sub.example.com")).toBe(false);
  });

  it("returns false for invalid urls", () => {
    expect(isLocal("not a url")).toBe(false);
  });
});

describe("openWeb", () => {
  it("shows a local url in the aside when internal", () => {
    openWeb("http://localhost:3000");
    expect(browserUrl.value).toBe("http://localhost:3000");
    expect(asideOpen.value).toBe(true);
    expect(asidePanel.value).toBe("browser");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("leaves the aside shut for an external url", () => {
    openWeb("https://example.com");
    expect(asideOpen.value).toBe(false);
    expect(browserUrl.value).toBeNull();
  });

  it("falls back to system browser for external", () => {
    openWeb("https://example.com");
    expect(invoke).toHaveBeenCalledWith("open_url", { url: "https://example.com" });
  });

  it("uses system browser when browsing is system", () => {
    (browsing as unknown as { value: string }).value = "system";
    openWeb("http://localhost:3000");
    expect(invoke).toHaveBeenCalledWith("open_url", { url: "http://localhost:3000" });
  });
});

describe("pickUrl", () => {
  it("prefers a running local server", () => {
    expect(pickUrl([null, "http://localhost:5173"], "http://localhost:9999")).toBe(
      "http://localhost:5173",
    );
  });

  it("falls back to the last url when nothing is running", () => {
    expect(pickUrl([null], "http://localhost:9999")).toBe("http://localhost:9999");
  });

  it("ignores a remembered url that is no longer local", () => {
    expect(pickUrl([], "https://example.com")).toBe("http://localhost:3000");
  });

  it("skips running sessions that are not local", () => {
    expect(pickUrl(["https://example.com", "http://127.0.0.1:8080"], null)).toBe(
      "http://127.0.0.1:8080",
    );
  });

  it("lands on the default with nothing to go on", () => {
    expect(pickUrl([], null)).toBe("http://localhost:3000");
  });
});

describe("toggleBrowser", () => {
  it("opens on the running server", () => {
    (projectSessions as unknown as { value: unknown[] }).value = [{ url: "http://localhost:4000" }];
    toggleBrowser();
    expect(browserUrl.value).toBe("http://localhost:4000");
    expect(asideOpen.value).toBe(true);
  });

  it("shuts the aside when the browser is already showing", () => {
    toggleBrowser();
    expect(asideOpen.value).toBe(true);
    toggleBrowser();
    expect(asideOpen.value).toBe(false);
  });

  it("comes back to the page it was left on", () => {
    openWeb("http://localhost:7000");
    toggleBrowser();
    expect(asideOpen.value).toBe(false);
    toggleBrowser();
    expect(asideOpen.value).toBe(true);
    expect(browserUrl.value).toBe("http://localhost:7000");
  });

  it("reopens where the last run left it after a restart", () => {
    openWeb("http://localhost:7000");
    browserUrl.value = null;
    closeAside();
    toggleBrowser();
    expect(browserUrl.value).toBe("http://localhost:7000");
  });
});

describe("readWord", () => {
  it("accepts a word the probe sent", () => {
    expect(readWord({ apex: true, kind: "loaded", url: "http://localhost:3000" })).toEqual({
      apex: true,
      kind: "loaded",
      url: "http://localhost:3000",
    });
  });

  it("refuses anything that does not carry the apex mark", () => {
    expect(readWord({ kind: "loaded", url: "http://evil" })).toBeNull();
    expect(readWord({ apex: "yes", kind: "loaded" })).toBeNull();
  });

  it("refuses a kind it does not know", () => {
    expect(readWord({ apex: true, kind: "eval" })).toBeNull();
    expect(readWord({ apex: true })).toBeNull();
  });

  it("refuses values that are not objects", () => {
    expect(readWord(null)).toBeNull();
    expect(readWord("apex")).toBeNull();
    expect(readWord(42)).toBeNull();
  });
});
