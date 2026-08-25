import MarkdownIt from "markdown-it";

const MAX_RENDER_BYTES = 512 * 1024;

const renderer = new MarkdownIt({ html: false, linkify: true, typographer: false });

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
