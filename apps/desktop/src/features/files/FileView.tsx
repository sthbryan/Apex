import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { FileContents } from "@/bindings/FileContents";
import { dropBuffer, keepBuffer, readBuffer } from "@/features/files/buffers";
import { openExternally } from "@/features/files/editors";
import {
  fileName,
  formatSize,
  isStaleWrite,
  isSvg,
  readFile,
  setSvgView,
  svgSource,
  svgView,
  writeFile,
} from "@/features/files/state";
import { TextEditor } from "@/features/files/TextEditor";
import { activeProject } from "@/features/projects/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function FileView({ path, chrome = true }: { path: string; chrome?: boolean }) {
  const project = activeProject.value;
  const projectId = project?.id ?? null;
  const [contents, setContents] = useState<FileContents | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const ticket = useRef(0);

  const load = useCallback(() => {
    if (!projectId) {
      return;
    }
    const mine = ++ticket.current;
    setContents(null);
    setSaved(null);
    setConflict(false);
    setEditing(readBuffer(projectId, path) !== null);
    setFailure(null);

    void readFile(projectId, path)
      .then((contents) => {
        if (mine !== ticket.current) {
          return;
        }
        setContents(contents);
        setSaved(contents.text);
      })
      .catch((error: unknown) => {
        if (mine === ticket.current) {
          setFailure(String(error));
        }
      });
  }, [projectId, path]);

  useEffect(load, [load]);

  const held = projectId ? readBuffer(projectId, path) : null;
  const buffer = held?.text ?? null;
  const revision = held?.revision ?? contents?.revision ?? null;
  const text = buffer ?? contents?.text ?? null;
  const drawn = text !== null && isSvg(path) && svgView.value === "preview";
  const writable = contents !== null && text !== null && !drawn && !contents.truncated;
  const dirty = buffer !== null && buffer !== saved;

  const edit = (next: string) => {
    if (!projectId) {
      return;
    }
    if (next === saved) {
      dropBuffer(projectId, path);
    } else {
      keepBuffer(projectId, path, next, revision);
    }
  };

  const save = useCallback(() => {
    if (!projectId || buffer === null || buffer === saved || saving) {
      return;
    }
    setSaving(true);
    void writeFile(projectId, path, buffer, revision)
      .then((next) => {
        setContents((current) =>
          current ? { ...current, text: buffer, revision: next } : current,
        );
        setSaved(buffer);
        dropBuffer(projectId, path);
        setConflict(false);
        setFailure(null);
      })
      .catch((error: unknown) => {
        if (isStaleWrite(error)) {
          setConflict(true);
        } else {
          setFailure(String(error));
        }
      })
      .finally(() => setSaving(false));
  }, [projectId, path, buffer, saved, revision, saving]);

  const lock = () => {
    if (projectId) {
      dropBuffer(projectId, path);
    }
    setConflict(false);
    setEditing(false);
  };

  const floppy = writable && editing && (
    <button
      type="button"
      title={t(dirty ? "files.save" : "files.saved")}
      disabled={!dirty || saving}
      onClick={save}
      class={
        dirty
          ? "shrink-0 text-accent transition-colors hover:text-text"
          : "shrink-0 text-faint opacity-40"
      }
    >
      <Icon name="save" size={12} />
    </button>
  );

  const pencil = writable && (
    <button
      type="button"
      title={t(editing ? (dirty ? "files.discardEdits" : "files.lock") : "files.edit")}
      onClick={() => (editing ? lock() : setEditing(true))}
      class={
        editing
          ? "shrink-0 text-accent transition-colors hover:text-text"
          : "shrink-0 text-faint transition-colors hover:text-text"
      }
    >
      <Icon name="pencil" size={12} />
    </button>
  );

  const toggle = text !== null && isSvg(path) && (
    <button
      type="button"
      title={t(drawn ? "files.showSource" : "files.showImage")}
      onClick={() => setSvgView(drawn ? "source" : "preview")}
      class="shrink-0 text-faint transition-colors hover:text-text"
    >
      <Icon name={drawn ? "fileCode" : "fileImage"} size={12} />
    </button>
  );

  return (
    <div class="flex h-full flex-col bg-pane">
      {chrome && (
        <header class="flex h-7 shrink-0 items-center gap-2 border-b border-border pr-7 pl-2">
          <Icon name="file" size={12} />
          <span class="truncate text-text">{fileName(path)}</span>
          <span class="truncate text-faint">{path}</span>
          <span class="ml-auto shrink-0 text-faint">
            {contents ? formatSize(contents.size) : ""}
          </span>
          {floppy}
          {pencil}
          {toggle}
          <button
            type="button"
            title={t("files.reload")}
            onClick={load}
            class="shrink-0 text-faint transition-colors hover:text-text"
          >
            <Icon name="refresh" size={12} />
          </button>
          {projectId && (
            <button
              type="button"
              title={t("files.openExternally")}
              onClick={() =>
                void openExternally(projectId, path).catch((error: unknown) =>
                  setFailure(String(error)),
                )
              }
              class="shrink-0 text-faint transition-colors hover:text-text"
            >
              <Icon name="external" size={12} />
            </button>
          )}
        </header>
      )}

      {!chrome && (pencil || toggle) && (
        <div class="flex h-6 shrink-0 items-center justify-end gap-2 border-b border-border px-2">
          {floppy}
          {pencil}
          {toggle}
        </div>
      )}

      {failure && <p class="p-3 text-state-failed">{failure}</p>}

      {contents?.image && (
        <div class="min-h-0 flex-1 overflow-auto p-4">
          <img
            src={contents.image}
            alt={fileName(path)}
            class="checkers mx-auto max-h-full animate-veil-in object-contain"
          />
        </div>
      )}

      {contents?.binary && !contents.image && <p class="p-3 text-faint">{t("files.binary")}</p>}

      {drawn && text !== null && (
        <div class="min-h-0 flex-1 overflow-auto p-4">
          <img
            src={svgSource(text)}
            alt={fileName(path)}
            class="checkers mx-auto max-h-full animate-veil-in object-contain"
          />
        </div>
      )}

      {conflict && (
        <div class="flex shrink-0 items-center gap-2 border-b border-border bg-raised px-2 py-1">
          <span class="grow text-state-failed">{t("files.conflict")}</span>
          <button
            type="button"
            onClick={load}
            class="shrink-0 text-faint transition-colors hover:text-text"
          >
            {t("files.discard")}
          </button>
        </div>
      )}

      {text !== null && !drawn && (
        <TextEditor
          key={path}
          path={path}
          text={text}
          editable={writable && editing}
          onInput={edit}
          onSave={save}
        />
      )}

      {contents?.truncated && (
        <footer class="shrink-0 border-t border-border px-2 py-1 text-faint">
          {t("files.truncated")}
        </footer>
      )}
    </div>
  );
}
