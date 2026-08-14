const MAX_HIGHLIGHT_BYTES = 300 * 1024;

const LANGUAGES: Record<string, string> = {
  bash: "bash",
  c: "c",
  cc: "cpp",
  cjs: "javascript",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  diff: "diff",
  go: "go",
  h: "c",
  hpp: "cpp",
  htm: "xml",
  html: "xml",
  java: "java",
  js: "javascript",
  json: "json",
  jsonc: "json",
  jsx: "javascript",
  kt: "kotlin",
  lua: "lua",
  md: "markdown",
  mdx: "markdown",
  mjs: "javascript",
  mts: "typescript",
  patch: "diff",
  php: "php",
  py: "python",
  rb: "ruby",
  rs: "rust",
  scss: "scss",
  sh: "bash",
  sql: "sql",
  svg: "xml",
  swift: "swift",
  toml: "ini",
  ts: "typescript",
  tsx: "typescript",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  zsh: "bash",
};

const FILENAMES: Record<string, string> = {
  ".gitignore": "bash",
  Makefile: "makefile",
};

let engine: Promise<typeof import("highlight.js/lib/common")> | null = null;

export async function highlight(path: string, text: string): Promise<string | null> {
  const language = languageFor(path);
  if (!language || text.length > MAX_HIGHLIGHT_BYTES) {
    return null;
  }

  const hljs = (await load()).default;
  if (!hljs.getLanguage(language)) {
    return null;
  }
  return hljs.highlight(text, { language, ignoreIllegals: true }).value;
}

function languageFor(path: string): string | null {
  const name = path.split("/").at(-1) ?? path;
  const known = FILENAMES[name];
  if (known) {
    return known;
  }
  const extension = name.includes(".") ? (name.split(".").at(-1) ?? "") : "";
  return LANGUAGES[extension.toLowerCase()] ?? null;
}

function load() {
  engine ??= import("highlight.js/lib/common");
  return engine;
}
