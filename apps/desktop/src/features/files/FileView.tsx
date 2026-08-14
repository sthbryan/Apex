import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "preact/hooks";

import type { FileContents } from "@/bindings/FileContents";
import { highlight } from "@/features/files/highlight";
import { fileName, formatSize, readFile } from "@/features/files/state";
import { activeProject } from "@/features/projects/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Loaded = {
  contents: FileContents;
  markup: string | null;
};

export function FileView({ path }: { path: string }) {
  const project = activeProject.value;
  const projectId = project?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    let cancelled = false;
    setLoaded(null);
    setFailure(null);

    void readFile(projectId, path)
      .then(async (contents) => {
        const markup = contents.text ? await highlight(path, contents.text) : null;
        if (!cancelled) {
          setLoaded({ contents, markup });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFailure(String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, path]);

  const contents = loaded?.contents ?? null;
  const text = contents?.text ?? null;
  const lines = text ? countLines(text) : 0;

  return (
    <div class="flex h-full flex-col bg-bg">
      <header class="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2">
        <Icon name="file" size={12} />
        <span class="truncate text-text">{fileName(path)}</span>
        <span class="truncate text-faint">{path}</span>
        <span class="ml-auto shrink-0 text-faint">{contents ? formatSize(contents.size) : ""}</span>
        {project && (
          <button
            type="button"
            title={t("files.openExternally")}
            onClick={() => void openPath(`${project.root}/${path}`)}
            class="shrink-0 text-faint transition-colors hover:text-text"
          >
            <Icon name="external" size={12} />
          </button>
        )}
      </header>

      {failure && <p class="p-3 text-state-failed">{failure}</p>}

      {contents?.binary && <p class="p-3 text-faint">{t("files.binary")}</p>}

      {text !== null && (
        <div class="min-h-0 flex-1 overflow-auto">
          <div class="flex min-h-full w-max min-w-full animate-veil-in leading-5">
            <div
              aria-hidden="true"
              class="sticky left-0 shrink-0 select-none border-r border-border bg-bg px-2 py-2 text-right text-faint"
            >
              {Array.from({ length: lines }, (_, index) => (
                <div key={index}>{index + 1}</div>
              ))}
            </div>
            <pre class="grow px-3 py-2">
              {loaded?.markup ? (
                <code dangerouslySetInnerHTML={{ __html: loaded.markup }} />
              ) : (
                <code>{text}</code>
              )}
            </pre>
          </div>
        </div>
      )}

      {contents?.truncated && (
        <footer class="shrink-0 border-t border-border px-2 py-1 text-faint">
          {t("files.truncated")}
        </footer>
      )}
    </div>
  );
}

function countLines(text: string): number {
  let count = 1;
  for (const character of text) {
    if (character === "\n") {
      count += 1;
    }
  }
  return text.endsWith("\n") ? count - 1 : count;
}
