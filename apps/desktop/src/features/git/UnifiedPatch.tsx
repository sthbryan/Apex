import { DiffFile, DiffHunk, DiffLine, type DiffLineKind } from "@apex/ui";
import type { ComponentChildren } from "preact";
import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";

import { highlight } from "@/features/files/highlight";
import { type DiffRow, parsePatch, splitMarkup } from "@/features/git/patch";

type Line = {
  kind: DiffLineKind;
  no: number | null;
  text: string;
  markup: string | null;
};

type Hunk = {
  header: string;
  lines: Line[];
};

type File = {
  path: string;
  added: number;
  removed: number;
  hunks: Hunk[];
};

type Props = {
  path: string;
  patch: string;
  actions?: ComponentChildren;
};

export function UnifiedPatch({ path, patch, actions }: Props) {
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    let alive = true;
    void render(path, patch).then((painted) => {
      if (alive) {
        setFiles(painted);
      }
    });
    return () => {
      alive = false;
    };
  }, [path, patch]);

  return (
    <>
      {files.map((file) => (
        <DiffFile
          key={file.path}
          class="animate-fade-in"
          path={file.path}
          added={file.added}
          removed={file.removed}
        >
          {file.hunks.map((hunk) => (
            <Fragment key={hunk.header}>
              <DiffHunk range={hunk.header} actions={actions} />
              {hunk.lines.map((line, index) => (
                <DiffLine key={`${hunk.header}-${index}`} kind={line.kind}>
                  <span class="ui-diff-no">{line.no ?? ""}</span>
                  {line.markup === null ? (
                    line.text
                  ) : (
                    <code dangerouslySetInnerHTML={{ __html: line.markup }} />
                  )}
                </DiffLine>
              ))}
            </Fragment>
          ))}
        </DiffFile>
      ))}
    </>
  );
}

function unify(rows: DiffRow[]): Line[] {
  const lines: Line[] = [];
  for (const row of rows) {
    if (row.kind === "del" || row.kind === "mod") {
      lines.push({
        kind: "del",
        no: row.left?.no ?? null,
        text: row.left?.text ?? "",
        markup: null,
      });
    }
    if (row.kind === "add" || row.kind === "mod") {
      lines.push({
        kind: "add",
        no: row.right?.no ?? null,
        text: row.right?.text ?? "",
        markup: null,
      });
    }
    if (row.kind === "same") {
      lines.push({
        kind: "ctx",
        no: row.right?.no ?? null,
        text: row.right?.text ?? "",
        markup: null,
      });
    }
  }
  return lines;
}

async function render(path: string, patch: string): Promise<File[]> {
  return Promise.all(
    parsePatch(patch).map(async (file) => {
      const name = file.path || path;
      const hunks = file.hunks.map((hunk) => ({ header: hunk.header, lines: unify(hunk.rows) }));
      const flat = hunks.flatMap((hunk) => hunk.lines);
      const painted = await paint(
        name,
        flat.map((line) => line.text),
      );
      flat.forEach((line, index) => {
        line.markup = painted[index] ?? null;
      });
      return {
        path: name,
        added: flat.filter((line) => line.kind === "add").length,
        removed: flat.filter((line) => line.kind === "del").length,
        hunks,
      };
    }),
  );
}

async function paint(path: string, lines: string[]): Promise<(string | null)[]> {
  const markup = await highlight(path, lines.join("\n"));
  if (!markup) {
    return lines.map(() => null);
  }
  const painted = splitMarkup(markup);
  return lines.map((_, index) => painted[index] ?? null);
}
