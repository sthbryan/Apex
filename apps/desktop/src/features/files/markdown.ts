import MarkdownIt from "markdown-it";

const MAX_RENDER_BYTES = 512 * 1024;

const renderer = new MarkdownIt({ html: false, linkify: true, typographer: false });

renderer.core.ruler.push("apexHeadings", (state) => {
  const taken = new Set<string>();
  state.tokens.forEach((token, index) => {
    if (token.type !== "heading_open") {
      return;
    }
    const inline = state.tokens[index + 1];
    if (inline?.type !== "inline") {
      return;
    }
    const name = slug(inline.content);
    if (!name || taken.has(name)) {
      return;
    }
    taken.add(name);
    token.attrSet("id", name);
  });
});

function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .replace(/ +/g, "-");
}

export function isMarkdown(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".mdx") || lower.endsWith(".markdown");
}

export function renderMarkdown(text: string): string | null {
  if (text.length > MAX_RENDER_BYTES) {
    return null;
  }
  return renderer.render(text);
}

export function resolveHref(from: string, href: string): string | null {
  const target = href.trim();
  if (
    target === "" ||
    target.startsWith("#") ||
    target.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  ) {
    return null;
  }
  const parts = target.replace(/[?#].*$/, "").split("/");
  if (["", ".", ".."].includes(parts[parts.length - 1] ?? "")) {
    return null;
  }
  const walked = target.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const part of parts) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (walked.length === 0) {
        return null;
      }
      walked.pop();
      continue;
    }
    walked.push(plain(part));
  }
  return walked.length > 0 ? walked.join("/") : null;
}

function plain(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}
