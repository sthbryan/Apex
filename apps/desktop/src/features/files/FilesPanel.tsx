import { TreeRow, type TreeStatus } from "@apex/ui";
import { Fragment } from "preact";
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

type Changes = {
  files: Map<string, TreeStatus>;
  dirs: Set<string>;
};

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
    <div class="dock-view dock-fixed">
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
      <div class="min-h-0 flex-1 overflow-auto py-2 pr-2">
        {treeFailure.value ? (
          <p class="px-2 text-state-failed">{treeFailure.value}</p>
        ) : (
          <Branch
            project={project.id}
            path=""
            depth={0}
            changes={status ? changesOf(status.changes) : null}
          />
        )}
      </div>
    </div>
  );
}

function changesOf(changes: { path: string; kind: string }[]): Changes {
  const files = new Map<string, TreeStatus>();
  const dirs = new Set<string>();
  for (const change of changes) {
    const status = statusOf(change.kind);
    if (!status) {
      continue;
    }
    files.set(change.path, status);
    const parts = change.path.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  return { files, dirs };
}

function statusOf(kind: string): TreeStatus | null {
  switch (kind) {
    case "added":
      return "added";
    case "untracked":
      return "untracked";
    case "modified":
    case "renamed":
      return "modified";
    case "deleted":
      return "removed";
    case "conflicted":
      return "conflicted";
    default:
      return null;
  }
}

type BranchProps = {
  project: string;
  path: string;
  depth: number;
  changes: Changes | null;
};

function Branch({ project, path, depth, changes }: BranchProps) {
  const entries = tree.value[path];
  if (!entries) {
    return null;
  }
  if (entries.length === 0 && depth === 0) {
    return <p class="px-2 text-faint">{t("files.empty")}</p>;
  }

  return (
    <>
      {entries.map((entry) => (
        <Fragment key={entry.path}>
          <Row project={project} entry={entry} depth={depth} changes={changes} />
          {entry.is_dir && expanded.value.includes(entry.path) && (
            <Branch project={project} path={entry.path} depth={depth + 1} changes={changes} />
          )}
        </Fragment>
      ))}
    </>
  );
}

function Row({
  project,
  entry,
  depth,
  changes,
}: {
  project: string;
  entry: FileEntry;
  depth: number;
  changes: Changes | null;
}) {
  const open = entry.is_dir && expanded.value.includes(entry.path);
  const unsaved = dirtyKeys.value.has(bufferKey(project, entry.path));
  const dirty = entry.is_dir && changes?.dirs.has(entry.path);

  return (
    <TreeRow
      name={entry.name}
      depth={depth}
      title={entry.path}
      expanded={entry.is_dir ? open : undefined}
      status={entry.is_dir ? undefined : changes?.files.get(entry.path)}
      class={unsaved ? "text-accent" : undefined}
      lead={
        <Icon name={entry.is_dir ? iconForDir(entry.name) : iconForFile(entry.name)} size={12} />
      }
      trail={
        unsaved ? (
          <Icon name="save" size={10} class="text-accent" />
        ) : dirty ? (
          <span aria-hidden="true" class="size-1.5 rounded-full bg-git-dirty" />
        ) : undefined
      }
      onClick={() => {
        if (entry.is_dir) {
          void toggleDirectory(project, entry.path);
        } else {
          openFile(entry.path);
        }
      }}
    />
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
