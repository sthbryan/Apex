import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

describe("highlight", () => {
  it("returns html for a known language", async () => {
    const html = await highlight("app.ts", "const x: number = 1;");
    expect(html).not.toBeNull();
    expect(html).toContain("const");
  });

  it("returns null for an unknown extension", async () => {
    expect(await highlight("file.unknown", "hello")).toBeNull();
  });

  it("returns null for a large file", async () => {
    const big = "a".repeat(400 * 1024);
    expect(await highlight("app.ts", big)).toBeNull();
  });

  it("maps extensions case-insensitively", async () => {
    expect(await highlight("APP.TS", "const a = 1")).not.toBeNull();
  });

  it("maps special filenames", async () => {
    expect(await highlight(".gitignore", "node_modules")).not.toBeNull();
    expect(await highlight("Makefile", "all: build")).not.toBeNull();
  });
});
