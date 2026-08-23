import cn from "cnfast";
import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";

import { highlight } from "@/features/files/highlight";
import { type DiffRow, parsePatch, splitMarkup } from "@/features/git/patch";

type PaintedRow = DiffRow & {
  leftMarkup: string | null;
  rightMarkup: string | null;
};

type PaintedHunk = {
  header: string;
  rows: PaintedRow[];
};

type PaintedFile = {
  path: string;
  hunks: PaintedHunk[];
};

type Props = {
  path: string;
  patch: string;
};

export function SplitPatch({ path, patch }: Props) {
  const [files, setFiles] = useState<PaintedFile[]>([]);

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
    <div class="w-full animate-fade-in font-mono text-md leading-5">
      {files.map((file) => (
        <Fragment key={file.path}>
          {files.length > 1 && (
            <h3 class="truncate border-b border-border bg-surface px-3 py-1 text-faint">
              {file.path}
            </h3>
          )}
          {file.hunks.map((hunk) => (
            <div key={hunk.header} class="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div class="col-span-4 truncate border-b border-border bg-surface px-3 py-px text-faint">
                {hunk.header}
              </div>
              {hunk.rows.map((row, index) => (
                <Fragment key={`${hunk.header}-${index}`}>
                  <Cell row={row} side="left" />
                  <Cell row={row} side="right" />
                </Fragment>
              ))}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

function Cell({ row, side }: { row: PaintedRow; side: "left" | "right" }) {
  const line = side === "left" ? row.left : row.right;
  const markup = side === "left" ? row.leftMarkup : row.rightMarkup;
  const touched = side === "left" ? row.kind === "del" || row.kind === "mod" : row.kind !== "same";
  const tint =
    line === null
      ? "bg-surface/40"
      : touched
        ? side === "left"
          ? "bg-git-removed/12"
          : "bg-git-added/12"
        : "";

  return (
    <>
      <span
        class={cn(
          "select-none px-2 text-right text-faint tabular-nums",
          side === "right" && "border-l border-border",
          tint,
        )}
      >
        {line?.no ?? ""}
      </span>
      <span class={cn("whitespace-pre-wrap break-words px-2", tint)}>
        {markup === null ? (
          (line?.text ?? "")
        ) : (
          <code dangerouslySetInnerHTML={{ __html: markup }} />
        )}
      </span>
    </>
  );
}

async function render(path: string, patch: string): Promise<PaintedFile[]> {
  return Promise.all(
    parsePatch(patch).map(async (file) => {
      const name = file.path || path;
      const hunks = await Promise.all(
        file.hunks.map(async (hunk) => {
          const [left, right] = await Promise.all([
            paintSide(
              name,
              hunk.rows.map((row) => row.left?.text ?? ""),
            ),
            paintSide(
              name,
              hunk.rows.map((row) => row.right?.text ?? ""),
            ),
          ]);
          return {
            header: hunk.header,
            rows: hunk.rows.map((row, index) => ({
              ...row,
              leftMarkup: left[index] ?? null,
              rightMarkup: right[index] ?? null,
            })),
          };
        }),
      );
      return { path: name, hunks };
    }),
  );
}

async function paintSide(path: string, lines: string[]): Promise<(string | null)[]> {
  const markup = await highlight(path, lines.join("\n"));
  if (!markup) {
    return lines.map(() => null);
  }
  const painted = splitMarkup(markup);
  return lines.map((_, index) => painted[index] ?? null);
}
