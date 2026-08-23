import { describe, expect, it } from "vitest";
import { editors, installedEditors } from "./editors";

describe("installedEditors", () => {
  it("filters to resolved editors", () => {
    editors.value = [
      { id: "a", name: "A", command: "code", resolved_path: "/usr/bin/code" },
      { id: "b", name: "B", command: "none", resolved_path: null },
    ] as never;
    expect(installedEditors().map((e) => e.id)).toEqual(["a"]);
  });

  it("returns empty when none are resolved", () => {
    editors.value = [{ id: "x", name: "X", command: "x", resolved_path: null }] as never;
    expect(installedEditors()).toHaveLength(0);
  });
});
