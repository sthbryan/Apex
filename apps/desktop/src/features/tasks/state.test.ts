import { describe, expect, it } from "vitest";
import { arrange, lastLines, suffix } from "./state";
import type { TaskSummary } from "@/bindings/TaskSummary";

function task(name: string, group: string | null = null): TaskSummary {
  return { name, group, command: "echo", description: "" } as TaskSummary;
}

describe("lastLines", () => {
  it("strips ansi and trims trailing spaces", () => {
    expect(lastLines("\u001b[31mhello\u001b[0m   \nworld  ", 2)).toEqual(["hello", "world"]);
  });

  it("drops empty lines", () => {
    expect(lastLines("a\n\n  \n b\n", 10)).toEqual(["a", " b"]);
  });

  it("keeps only the tail", () => {
    expect(lastLines("a\nb\nc\nd", 2)).toEqual(["c", "d"]);
  });

  it("handles empty input", () => {
    expect(lastLines("", 5)).toEqual([]);
  });
});

describe("suffix", () => {
  it("removes the group prefix", () => {
    expect(suffix("build:check", "build")).toBe("check");
    expect(suffix("build check", "build")).toBe("check");
  });

  it("returns the full name when it equals the group", () => {
    expect(suffix("build", "build")).toBe("build");
  });

  it("keeps names without prefix", () => {
    expect(suffix("test", "build")).toBe("test");
  });
});

describe("arrange", () => {
  it("keeps ungrouped tasks as tasks", () => {
    const entries = arrange([task("a"), task("b")]);
    expect(entries.map((e) => e.kind)).toEqual(["task", "task"]);
  });

  it("groups tasks sharing a group", () => {
    const entries = arrange([task("build", "build"), task("build:check", "build"), task("build:run", "build")]);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("group");
    if (entries[0].kind === "group") {
      expect(entries[0].group.name).toBe("build");
      expect(entries[0].group.parent?.name).toBe("build");
      expect(entries[0].group.children.map((c) => c.name)).toEqual(["build:check", "build:run"]);
    }
  });

  it("creates a group even when parent is missing", () => {
    const entries = arrange([task("build:check", "build")]);
    expect(entries[0].kind).toBe("group");
    if (entries[0].kind === "group") {
      expect(entries[0].group.parent).toBeNull();
      expect(entries[0].group.children).toHaveLength(1);
    }
  });

  it("preserves order between groups and tasks", () => {
    const entries = arrange([task("a"), task("build:check", "build"), task("b")]);
    expect(entries.map((e) => (e.kind === "task" ? e.task.name : e.group.name))).toEqual(["a", "build", "b"]);
  });
});
