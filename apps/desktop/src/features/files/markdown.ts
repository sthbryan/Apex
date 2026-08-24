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
