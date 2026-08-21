import cn from "cnfast";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { GitTarget } from "@/bindings/GitTarget";
import type { RejectedHunk } from "@/bindings/RejectedHunk";
import { highlight } from "@/features/files/highlight";
import { ImageDiff } from "@/features/git/ImageDiff";
import { binary, binaryPaths, splittable } from "@/features/git/patch";
import { SplitPatch } from "@/features/git/SplitPatch";
import {
  clearRejects,
  diffLayout,
  gitStatus,
  readDiff,
  readHunks,
  readRejects,
  refreshPending,
  rejectHunk,
  restoreReject,
  setDiffLayout,
  stageHunk,
} from "@/features/git/state";
import { inReview, reviewFiles, stepReview } from "@/features/review/state";
import { sessions } from "@/features/sessions/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const SPLIT_WIDTH = 720;

type Painted = {
  patch: string;
  markup: string | null;
};

type Props = {
  target: GitTarget;
  path: string;
  commit: string | null;
  chrome?: boolean;
};

export function DiffView({ target, path, commit, chrome = true }: Props) {
  const [unstaged, setUnstaged] = useState<Painted[]>([]);
  const [staged, setStaged] = useState<Painted[]>([]);
  const [whole, setWhole] = useState<Painted | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [shelf, setShelf] = useState<RejectedHunk[]>([]);
  const [wide, setWide] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const ticket = useRef(0);

  const session = sessions.value.find(
    (candidate) => target.type === "session" && candidate.id === target.id,
  );
  const label =
    target.type === "worktree"
      ? (target.path.split("/").at(-1) ?? "")
      : (session?.worktree?.branch ?? session?.title ?? gitStatus.value?.branch ?? "");

  const load = useCallback(() => {
    const mine = ++ticket.current;
    setFailure(null);

    const work = commit
      ? readDiff(target, path, commit).then(async (text) => {
          const painted = { patch: text, markup: await paint(text) };
          if (mine === ticket.current) {
            setWhole(painted);
          }
        })
      : Promise.all([
          readHunks(target, path, "unstaged").then(paintAll),
          readHunks(target, path, "staged").then(paintAll),
        ]).then(([fresh, ready]) => {
          if (mine === ticket.current) {
            setUnstaged(fresh);
            setStaged(ready);
          }
        });

    void work.catch((error: unknown) => {
      if (mine === ticket.current) {
        setFailure(String(error));
      }
    });
  }, [target, path, commit]);

  useEffect(load, [load]);

  useEffect(() => {
    const node = frame.current;
    if (!node) {
      return;
    }
    const watcher = new ResizeObserver(([entry]) => {
      setWide(entry.contentRect.width >= SPLIT_WIDTH);
    });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  const split = wide && diffLayout.value === "split";

  const walking = !commit && inReview(target);

  const lookShelf = useCallback(() => {
    if (!walking) {
      return;
    }
    void readRejects(target)
      .then(setShelf)
      .catch(() => setShelf([]));
  }, [target, walking]);

  useEffect(lookShelf, [lookShelf]);

  const reject = (patch: string) => {
    void rejectHunk(target, patch)
      .then(load)
      .then(lookShelf)
      .catch((error: unknown) => setFailure(String(error)));
  };

  const undo = (id: string) => {
    void restoreReject(target, id)
      .then(load)
      .then(lookShelf)
      .catch((error: unknown) => setFailure(String(error)));
  };

  const apply = (patch: string, stage: boolean) => {
    void stageHunk(target, patch, stage)
      .then(load)
      .then(refreshPending)
      .catch((error: unknown) => setFailure(String(error)));
  };

  const empty = commit
    ? whole !== null && whole.patch.trim() === ""
    : unstaged.length === 0 && staged.length === 0;

  const files = walking ? reviewFiles() : [];
  const at = files.indexOf(path);

  const walker = walking && files.length > 1 && (
    <>
      <button
        type="button"
        title={t("review.previous")}
        disabled={at <= 0}
        onClick={() => stepReview(target, path, -1)}
        class="shrink-0 text-faint transition-colors hover:text-text disabled:opacity-30"
      >
        <Icon name="chevronLeft" size={12} />
      </button>
      <span class="shrink-0 text-faint">
        {t("review.position", { at: String(at + 1), total: String(files.length) })}
      </span>
      <button
        type="button"
        title={t("review.next")}
        disabled={at === -1 || at >= files.length - 1}
        onClick={() => stepReview(target, path, 1)}
        class="shrink-0 text-faint transition-colors hover:text-text disabled:opacity-30"
      >
        <Icon name="chevronRight" size={12} />
      </button>
    </>
  );

  const toggle = wide && (
    <button
      type="button"
      title={t(split ? "git.unifiedView" : "git.splitView")}
      onClick={() => setDiffLayout(split ? "unified" : "split")}
      class="shrink-0 text-faint transition-colors hover:text-text"
    >
      <Icon name={split ? "rows" : "columns"} size={12} />
    </button>
  );

  return (
    <div ref={frame} class="flex h-full flex-col bg-pane">
      {chrome && (
        <header class="flex h-7 shrink-0 items-center gap-2 border-b border-border pr-7 pl-2">
          <Icon name="branch" size={12} />
          <span class="truncate text-text">{path || (commit ?? "").slice(0, 7)}</span>
          <span class="truncate text-faint">{label}</span>
          <div class="ml-auto flex shrink-0 items-center gap-2">
            {walker}
            {toggle}
            <button
              type="button"
              title={t("git.reload")}
              onClick={load}
              class="text-faint transition-colors hover:text-text"
            >
              <Icon name="refresh" size={12} />
            </button>
          </div>
        </header>
      )}

      {!chrome && (walker || toggle) && (
        <div class="flex h-6 shrink-0 items-center justify-end gap-2 border-b border-border px-2">
          {walker}
          {toggle}
        </div>
      )}

      {failure && <p class="p-3 text-state-failed">{failure}</p>}

      {walking && shelf.length > 0 && (
        <Shelf
          rejects={shelf}
          onUndo={undo}
          onClear={() => void clearRejects(target).then(lookShelf)}
        />
      )}

      {empty && <p class="p-3 text-faint">{t("git.noDiff")}</p>}

      <div class="min-h-0 flex-1 overflow-auto">
        {whole && commit && (
          <Patch painted={whole} path={path} split={split} target={target} commit={commit} />
        )}

        {!commit && (
          <>
            <Group
              label={t(walking ? "review.pending" : "git.unstagedHunks")}
              hunks={unstaged}
              action={t(walking ? "review.approve" : "git.stageHunk")}
              onApply={(patch) => apply(patch, true)}
              onReject={walking ? reject : undefined}
              path={path}
              split={split}
              target={target}
            />
            <Group
              label={t(walking ? "review.approved" : "git.stagedHunks")}
              hunks={staged}
              action={t(walking ? "review.undoApprove" : "git.unstageHunk")}
              onApply={(patch) => apply(patch, false)}
              tone="text-git-added"
              path={path}
              split={split}
              target={target}
            />
          </>
        )}
      </div>
    </div>
  );
}

type GroupProps = {
  label: string;
  hunks: Painted[];
  action: string;
  onApply: (patch: string) => void;
  onReject?: (patch: string) => void;
  tone?: string;
  path: string;
  split: boolean;
  target: GitTarget;
};

function Group({ label, hunks, action, onApply, onReject, tone, path, split, target }: GroupProps) {
  if (hunks.length === 0) {
    return null;
  }
  return (
    <section>
      <h2
        class={cn(
          "sticky top-0 z-10 border-b border-border bg-surface px-3 py-1 text-micro uppercase tracking-wider",
          tone ?? "text-faint",
        )}
      >
        {label}
      </h2>
      {hunks.map((hunk) => (
        <div key={hunk.patch} class="group/hunk relative border-b border-border">
          <div class="absolute top-1 right-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover/hunk:opacity-100">
            <button
              type="button"
              onClick={() => onApply(hunk.patch)}
              class="rounded border border-border bg-surface px-1.5 text-faint transition-colors hover:text-text"
            >
              {action}
            </button>
            {onReject && (
              <button
                type="button"
                onClick={() => onReject(hunk.patch)}
                class="rounded border border-border bg-surface px-1.5 text-faint transition-colors hover:text-state-failed"
              >
                {t("review.reject")}
              </button>
            )}
          </div>
          <Patch painted={hunk} path={path} split={split} target={target} commit={null} />
        </div>
      ))}
    </section>
  );
}

function Shelf({
  rejects,
  onUndo,
  onClear,
}: {
  rejects: RejectedHunk[];
  onUndo: (id: string) => void;
  onClear: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const last = rejects[0];
  return (
    <div class="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1">
      <span class="min-w-0 flex-1 truncate text-faint">
        {t("review.rejected", { count: String(rejects.length), path: last?.path ?? "" })}
      </span>
      {last && (
        <button
          type="button"
          onClick={() => onUndo(last.id)}
          class="shrink-0 text-muted transition-colors hover:text-text"
        >
          {t("review.undoReject")}
        </button>
      )}
      {asking ? (
        <>
          <span class="shrink-0 text-state-failed">{t("review.clearAsk")}</span>
          <button
            type="button"
            onClick={() => {
              setAsking(false);
              onClear();
            }}
            class="shrink-0 text-state-failed transition-colors hover:text-text"
          >
            {t("review.clearYes")}
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            class="shrink-0 text-faint transition-colors hover:text-text"
          >
            {t("review.clearNo")}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          {t("review.clear")}
        </button>
      )}
    </div>
  );
}

type PatchProps = {
  painted: Painted;
  path: string;
  split: boolean;
  target: GitTarget;
  commit: string | null;
};

function Patch({ painted, path, split, target, commit }: PatchProps) {
  if (split && splittable(painted.patch)) {
    return <SplitPatch path={path} patch={painted.patch} />;
  }
  const plain = (
    <pre class="w-max min-w-full animate-veil-in px-3 py-2 leading-5">
      {painted.markup ? (
        <code dangerouslySetInnerHTML={{ __html: painted.markup }} />
      ) : (
        <code>{painted.patch}</code>
      )}
    </pre>
  );

  const images = path ? (binary(painted.patch) ? [path] : []) : binaryPaths(painted.patch);

  if (split && images.length > 0) {
    return (
      <ImageDiff target={target} paths={images} commit={commit} named={!path}>
        {plain}
      </ImageDiff>
    );
  }
  return plain;
}

async function paint(patch: string): Promise<string | null> {
  return patch ? highlight("patch.diff", patch) : null;
}

async function paintAll(patches: string[]): Promise<Painted[]> {
  return Promise.all(patches.map(async (patch) => ({ patch, markup: await paint(patch) })));
}
