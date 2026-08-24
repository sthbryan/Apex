import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dockOrder } from "@/app/layout/state";
import { DockOrder } from "@/features/settings/DockOrder";
import { render } from "@/test/render";

function rowsOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("li[data-seat]"));
}

function tap(row: HTMLElement, key: string): void {
  act(() => {
    row.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dockOrder.value = ["sessions", "history", "tasks"];
});

describe("DockOrder by keyboard", () => {
  it("walks a panel down the list", () => {
    const { container } = render(<DockOrder />);

    tap(rowsOf(container)[0], "ArrowDown");

    expect(dockOrder.value).toEqual(["history", "sessions", "tasks"]);
  });

  it("walks a panel back up", () => {
    const { container } = render(<DockOrder />);

    tap(rowsOf(container)[2], "ArrowUp");

    expect(dockOrder.value).toEqual(["sessions", "tasks", "history"]);
  });

  it("leaves the first panel alone when it cannot go higher", () => {
    const { container } = render(<DockOrder />);

    tap(rowsOf(container)[0], "ArrowUp");

    expect(dockOrder.value).toEqual(["sessions", "history", "tasks"]);
  });

  it("sends the last panel to a tab when it walks past the line", () => {
    const { container } = render(<DockOrder />);

    tap(rowsOf(container)[2], "ArrowDown");

    expect(dockOrder.value).toEqual(["sessions", "history"]);
  });

  it("ignores keys that are not the arrows", () => {
    const { container } = render(<DockOrder />);

    tap(rowsOf(container)[0], "Enter");

    expect(dockOrder.value).toEqual(["sessions", "history", "tasks"]);
  });
});
