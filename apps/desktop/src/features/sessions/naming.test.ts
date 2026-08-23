import { describe, expect, it } from "vitest";
import { slugify, suggestName } from "./naming";

describe("slugify", () => {
  it("lowercases and replaces separators", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("My Project_123")).toBe("my-project-123");
  });

  it("trims dashes", () => {
    expect(slugify("---hello---")).toBe("hello");
  });

  it("falls back to ellipsis when empty", () => {
    expect(slugify("")).toBe("…");
    expect(slugify("---")).toBe("…");
  });
});

describe("suggestName", () => {
  it("prefixes with the agent and a date stamp", () => {
    const name = suggestName("claude");
    expect(name).toMatch(/^claude-\d{4}$/);
  });
});
