import { describe, expect, it } from "vitest";
import { isMarkdown, renderMarkdown } from "@/features/files/markdown";

describe("isMarkdown", () => {
  it("knows the markdown extensions and nothing else", () => {
    expect(isMarkdown("docs/README.md")).toBe(true);
    expect(isMarkdown("docs/README.MD")).toBe(true);
    expect(isMarkdown("a.mdx")).toBe(true);
    expect(isMarkdown("a.markdown")).toBe(true);
    expect(isMarkdown("a.mdc")).toBe(false);
    expect(isMarkdown("a.ts")).toBe(false);
  });
});

describe("renderMarkdown", () => {
  it("renders the document", () => {
    expect(renderMarkdown("# Apex\n\nA line.")).toContain("<h1>Apex</h1>");
  });

  it("escapes embedded html instead of running it", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("gives up on documents too big to paint", () => {
    expect(renderMarkdown("x".repeat(512 * 1024 + 1))).toBeNull();
  });
});
