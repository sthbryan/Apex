import cn from "cnfast";
import { useEffect } from "preact/hooks";
import { PanelActions } from "@/app/layout/PanelActions";
import type { FileEntry } from "@/bindings/FileEntry";
import { bufferKey, dirtyKeys } from "@/features/files/buffers";
import {
  expanded,
  openTree,
  refreshTree,
  toggleDirectory,
  tree,
  treeFailure,
} from "@/features/files/state";
import { gitStatus } from "@/features/git/state";
import { activeProject } from "@/features/projects/state";
import { openFile } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";

export function FilesPanel() {
  const project = activeProject.value;
  const projectId = project?.id ?? null;
  const status = gitStatus.value;

  useEffect(() => {
    if (projectId) {
      void openTree(projectId);
    }
  }, [projectId]);

  if (!project) {
    return <p class="p-2 text-faint">{t("files.noProject")}</p>;
  }

  return (
    <div class="flex h-full flex-col">
      <PanelActions>
        <button
          type="button"
          title={t("files.refresh")}
          onClick={() => void refreshTree(project.id)}
          class="text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </PanelActions>
      <div class="min-h-0 flex-1 overflow-auto pb-2">
        {treeFailure.value ? (
          <p class="px-2 text-state-failed">{treeFailure.value}</p>
        ) : (
          <Branch
            project={project.id}
            path=""
            depth={0}
            statuses={status ? changesMap(status.changes) : null}
          />
        )}
      </div>
    </div>
  );
}

function changesMap(changes: { path: string; kind: string }[]): Map<string, string> {
  const tones = new Map<string, string>();
  for (const change of changes) {
    const tone = toneOf(change.kind);
    if (!tone) {
      continue;
    }
    tones.set(change.path, tone);
    const parts = change.path.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      const dir = parts.slice(0, i).join("/");
      if (!tones.has(dir)) {
        tones.set(dir, "bg-faint");
      }
    }
  }
  return tones;
}

function toneOf(kind: string): string | null {
  switch (kind) {
    case "added":
    case "untracked":
      return "bg-git-added";
    case "modified":
    case "renamed":
      return "bg-git-modified";
    case "deleted":
      return "bg-git-removed";
    case "conflicted":
      return "bg-git-conflict";
    default:
      return null;
  }
}

type BranchProps = {
  project: string;
  path: string;
  depth: number;
  statuses: Map<string, string> | null;
};

function Branch({ project, path, depth, statuses }: BranchProps) {
  const entries = tree.value[path];
  if (!entries) {
    return null;
  }
  if (entries.length === 0 && depth === 0) {
    return <p class="px-2 text-faint">{t("files.empty")}</p>;
  }

  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry.path}>
          <Row project={project} entry={entry} depth={depth} statuses={statuses} />
          {entry.is_dir && expanded.value.includes(entry.path) && (
            <Branch project={project} path={entry.path} depth={depth + 1} statuses={statuses} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Row({
  project,
  entry,
  depth,
  statuses,
}: {
  project: string;
  entry: FileEntry;
  depth: number;
  statuses: Map<string, string> | null;
}) {
  const open = entry.is_dir && expanded.value.includes(entry.path);
  const tone = statuses?.get(entry.path);
  const unsaved = dirtyKeys.value.has(bufferKey(project, entry.path));

  return (
    <button
      type="button"
      onClick={() => {
        if (entry.is_dir) {
          void toggleDirectory(project, entry.path);
        } else {
          openFile(entry.path);
        }
      }}
      style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
      class="flex w-full items-center gap-1 py-px pr-2 text-left text-muted transition-colors hover:bg-raised hover:text-text"
    >
      <span class="flex size-3.5 shrink-0 items-center justify-center text-faint">
        {entry.is_dir && (
          <Icon
            name="chevron"
            size={12}
            class={cn("transition-transform", open ? "" : "-rotate-90")}
          />
        )}
      </span>
      <Icon
        name={entry.is_dir ? iconForDir(entry.name) : iconForFile(entry.name)}
        size={12}
        class="shrink-0 text-faint"
      />
      <span class={cn("truncate", unsaved && "text-accent")}>{entry.name}</span>
      {unsaved && <Icon name="save" size={10} class="shrink-0 text-accent" />}
      {tone && (
        <span
          aria-hidden="true"
          title={entry.path}
          class={cn("ml-auto size-1.5 shrink-0 rounded-full", tone)}
        />
      )}
    </button>
  );
}

function iconForDir(name: string): IconName {
  if (name === ".git") return "folderGit";
  return "files";
}

function iconForFile(name: string): IconName {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
    case "py":
    case "rs":
    case "go":
    case "java":
    case "c":
    case "cpp":
    case "h":
    case "hpp":
    case "rb":
    case "php":
    case "swift":
    case "kt":
    case "scala":
    case "sh":
    case "bash":
    case "zsh":
      return "fileCode";
    case "json":
    case "jsonc":
      return "fileJson";
    case "md":
    case "mdx":
    case "txt":
    case "rst":
      return "fileText";
    case "toml":
    case "yaml":
    case "yml":
    case "ini":
    case "env":
    case "conf":
    case "config":
      return "fileCog";
    case "lock":
      return "fileLock";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "bmp":
    case "ico":
    case "svg":
      return "fileImage";
    case "zip":
    case "tar":
    case "gz":
    case "tgz":
    case "7z":
    case "rar":
      return "fileArchive";
    case "sql":
    case "db":
    case "sqlite":
      return "database";
    default:
      return "file";
  }
}
