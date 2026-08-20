import cn from "cnfast";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { GitTarget } from "@/bindings/GitTarget";
import { highlight } from "@/features/files/highlight";
import { splittable } from "@/features/git/patch";
import { SplitPatch } from "@/features/git/SplitPatch";
import {
  diffLayout,
  gitStatus,
  readDiff,
  readHunks,
  setDiffLayout,
  stageHunk,
} from "@/features/git/state";
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

  const apply = (patch: string, stage: boolean) => {
    void stageHunk(target, patch, stage)
      .then(load)
      .catch((error: unknown) => setFailure(String(error)));
  };

  const empty = commit
    ? whole !== null && whole.patch.trim() === ""
    : unstaged.length === 0 && staged.length === 0;

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

      {!chrome && toggle && (
        <div class="flex h-6 shrink-0 items-center justify-end border-b border-border px-2">
          {toggle}
        </div>
      )}

      {failure && <p class="p-3 text-state-failed">{failure}</p>}

      {empty && <p class="p-3 text-faint">{t("git.noDiff")}</p>}

      <div class="min-h-0 flex-1 overflow-auto">
        {whole && commit && <Patch painted={whole} path={path} split={split} />}

        {!commit && (
          <>
            <Group
              label={t("git.unstagedHunks")}
              hunks={unstaged}
              action={t("git.stageHunk")}
              onApply={(patch) => apply(patch, true)}
              path={path}
              split={split}
            />
            <Group
              label={t("git.stagedHunks")}
              hunks={staged}
              action={t("git.unstageHunk")}
              onApply={(patch) => apply(patch, false)}
              tone="text-git-added"
              path={path}
              split={split}
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
  tone?: string;
  path: string;
  split: boolean;
};

function Group({ label, hunks, action, onApply, tone, path, split }: GroupProps) {
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
          <button
            type="button"
            onClick={() => onApply(hunk.patch)}
            class="absolute top-1 right-2 z-10 rounded border border-border bg-surface px-1.5 text-faint opacity-0 transition-[opacity,color] group-hover/hunk:opacity-100 hover:text-text"
          >
            {action}
          </button>
          <Patch painted={hunk} path={path} split={split} />
        </div>
      ))}
    </section>
  );
}

function Patch({ painted, path, split }: { painted: Painted; path: string; split: boolean }) {
  if (split && splittable(painted.patch)) {
    return <SplitPatch path={path} patch={painted.patch} />;
  }
  return (
    <pre class="w-max min-w-full animate-veil-in px-3 py-2 leading-5">
      {painted.markup ? (
        <code dangerouslySetInnerHTML={{ __html: painted.markup }} />
      ) : (
        <code>{painted.patch}</code>
      )}
    </pre>
  );
}

async function paint(patch: string): Promise<string | null> {
  return patch ? highlight("patch.diff", patch) : null;
}

async function paintAll(patches: string[]): Promise<Painted[]> {
  return Promise.all(patches.map(async (patch) => ({ patch, markup: await paint(patch) })));
}
