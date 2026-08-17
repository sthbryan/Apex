import cn from "cnfast";
import { useEffect } from "preact/hooks";
import { PanelHeader } from "@/app/layout/PanelHeader";
import type { FileEntry } from "@/bindings/FileEntry";
import {
  expanded,
  openTree,
  refreshTree,
  toggleDirectory,
  tree,
  treeFailure,
} from "@/features/files/state";
import { activeProject } from "@/features/projects/state";
import { openFile } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";

export function FilesPanel() {
  const project = activeProject.value;
  const projectId = project?.id ?? null;

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
      <PanelHeader title={project.name}>
        <button
          type="button"
          title={t("files.refresh")}
          onClick={() => void refreshTree(project.id)}
          class="text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </PanelHeader>
      <div class="min-h-0 flex-1 overflow-auto pb-2">
        {treeFailure.value ? (
          <p class="px-2 text-state-failed">{treeFailure.value}</p>
        ) : (
          <Branch project={project.id} path="" depth={0} />
        )}
      </div>
    </div>
  );
}

type BranchProps = {
  project: string;
  path: string;
  depth: number;
};

function Branch({ project, path, depth }: BranchProps) {
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
          <Row project={project} entry={entry} depth={depth} />
          {entry.is_dir && expanded.value.includes(entry.path) && (
            <Branch project={project} path={entry.path} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Row({ project, entry, depth }: { project: string; entry: FileEntry; depth: number }) {
  const open = entry.is_dir && expanded.value.includes(entry.path);

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
      <span class="truncate">{entry.name}</span>
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
