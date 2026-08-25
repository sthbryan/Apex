import { describe, expect, it } from "vitest";
import { isMarkdown, renderMarkdown, resolveHref } from "@/features/files/markdown";

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

describe("resolveHref", () => {
  it("walks the target from the folder of the open file", () => {
    expect(resolveHref("docs/guide.md", "./shot.png")).toBe("docs/shot.png");
    expect(resolveHref("docs/guide.md", "shot.png")).toBe("docs/shot.png");
    expect(resolveHref("docs/api/guide.md", "../shot.png")).toBe("docs/shot.png");
    expect(resolveHref("README.md", "docs/guide.md")).toBe("docs/guide.md");
  });

  it("reads a leading slash as the root of the project", () => {
    expect(resolveHref("docs/api/guide.md", "/README.md")).toBe("README.md");
  });

  it("refuses to leave the project", () => {
    expect(resolveHref("docs/guide.md", "../../etc/passwd")).toBeNull();
  });

  it("hands back the name the file actually has", () => {
    expect(resolveHref("docs/guide.md", "./una%20captura.png")).toBe("docs/una captura.png");
  });

  it("drops the query and the fragment", () => {
    expect(resolveHref("docs/guide.md", "guide.md#modo-juez")).toBe("docs/guide.md");
    expect(resolveHref("docs/guide.md", "shot.png?v=2")).toBe("docs/shot.png");
  });

  it("keeps its hands off anything that is not a path in the project", () => {
    expect(resolveHref("docs/guide.md", "https://apex.dev")).toBeNull();
    expect(resolveHref("docs/guide.md", "mailto:a@b.c")).toBeNull();
    expect(resolveHref("docs/guide.md", "data:image/png;base64,AAAA")).toBeNull();
    expect(resolveHref("docs/guide.md", "//apex.dev/x.png")).toBeNull();
    expect(resolveHref("docs/guide.md", "#modo-juez")).toBeNull();
    expect(resolveHref("docs/guide.md", "  ")).toBeNull();
    expect(resolveHref("docs/guide.md", "./")).toBeNull();
  });
});
