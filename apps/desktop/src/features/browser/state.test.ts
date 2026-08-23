import { signal } from "@preact/signals";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const openBrowser = vi.fn();
const listen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listen(...args),
}));

vi.mock("@/features/settings/browsing", () => ({
  browsing: signal("internal"),
}));

vi.mock("@/features/workspace/state", () => ({
  openBrowser: (...args: unknown[]) => openBrowser(...args),
}));

vi.mock("@/shared/daemon", () => ({
  complain: () => {},
}));

import { browsing } from "@/features/settings/browsing";
import { isLocal, openWeb } from "./state";

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue(undefined);
  openBrowser.mockReset();
  (browsing as unknown as { value: string }).value = "internal";
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
  it("opens locally in a pane when internal", () => {
    openWeb("http://localhost:3000", "test");
    expect(openBrowser).toHaveBeenCalledWith("http://localhost:3000", "test");
    expect(invoke).not.toHaveBeenCalled();
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
