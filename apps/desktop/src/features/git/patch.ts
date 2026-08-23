export type Side = {
  no: number;
  text: string;
};

export type DiffRow = {
  kind: "same" | "add" | "del" | "mod";
  left: Side | null;
  right: Side | null;
};

export type DiffHunk = {
  header: string;
  rows: DiffRow[];
};

export type DiffFile = {
  path: string;
  hunks: DiffHunk[];
};

const HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const TOKEN = /<[^>]+>|[^<]+/g;

export function splittable(patch: string): boolean {
  return /^@@ /m.test(patch);
}

export function binary(patch: string): boolean {
  return /^Binary files /m.test(patch);
}

export function binaryPaths(patch: string): string[] {
  const found: string[] = [];
  let current: string | null = null;

  for (const line of patch.split("\n")) {
    const named = /^diff --git a\/.+ b\/(.+)$/.exec(line);
    if (named) {
      current = named[1];
      continue;
    }
    if (current && line.startsWith("Binary files ")) {
      found.push(current);
      current = null;
    }
  }
  return found;
}

export function parsePatch(patch: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let left = 0;
  let right = 0;
  let removed: string[] = [];
  let added: string[] = [];
  let removedAt = 0;
  let addedAt = 0;

  const flush = () => {
    if (hunk) {
      const span = Math.max(removed.length, added.length);
      for (let index = 0; index < span; index += 1) {
        const gone = removed[index];
        const fresh = added[index];
        hunk.rows.push({
          kind:
            gone !== undefined && fresh !== undefined ? "mod" : gone !== undefined ? "del" : "add",
          left: gone === undefined ? null : { no: removedAt + index, text: gone },
          right: fresh === undefined ? null : { no: addedAt + index, text: fresh },
        });
      }
    }
    removed = [];
    added = [];
  };

  for (const line of patch.replace(/\n$/, "").split("\n")) {
    if (line.startsWith("diff --git")) {
      flush();
      hunk = null;
      file = { path: "", hunks: [] };
      files.push(file);
      continue;
    }
    if (line.startsWith("+++ ")) {
      if (file) {
        file.path = line.slice(4).replace(/^b\//, "");
      }
      continue;
    }
    const found = HEADER.exec(line);
    if (found) {
      flush();
      if (!file) {
        file = { path: "", hunks: [] };
        files.push(file);
      }
      hunk = { header: line, rows: [] };
      file.hunks.push(hunk);
      left = Number(found[1]);
      right = Number(found[2]);
      continue;
    }
    if (!hunk || line.startsWith("\\")) {
      continue;
    }
    if (line.startsWith("-")) {
      if (removed.length === 0) {
        removedAt = left;
      }
      removed.push(line.slice(1));
      left += 1;
      continue;
    }
    if (line.startsWith("+")) {
      if (added.length === 0) {
        addedAt = right;
      }
      added.push(line.slice(1));
      right += 1;
      continue;
    }
    flush();
    const text = line.slice(1);
    hunk.rows.push({
      kind: "same",
      left: { no: left, text },
      right: { no: right, text },
    });
    left += 1;
    right += 1;
  }
  flush();

  return files.filter((entry) => entry.hunks.length > 0);
}

function closing(open: string[]): string {
  return open
    .map((tag) => `</${/^<([a-zA-Z0-9-]+)/.exec(tag)?.[1] ?? "span"}>`)
    .reverse()
    .join("");
}

export function splitMarkup(markup: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let current = "";

  for (const [piece] of markup.matchAll(TOKEN)) {
    if (piece.startsWith("<")) {
      if (piece.startsWith("</")) {
        open.pop();
      } else if (!piece.endsWith("/>")) {
        open.push(piece);
      }
      current += piece;
      continue;
    }
    const parts = piece.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) {
        lines.push(current + closing(open));
        current = open.join("");
      }
      current += part;
    });
  }
  lines.push(current + closing(open));

  return lines;
}
