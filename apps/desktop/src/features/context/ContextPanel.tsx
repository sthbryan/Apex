import { ListRow } from "@apex/ui";
import { useCallback, useEffect, useState } from "preact/hooks";

import { PanelActions } from "@/app/layout/PanelActions";
import { entries, failure, loadContext, readEntry, writeEntry } from "@/features/context/state";
import { activeProject } from "@/features/projects/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function ContextPanel() {
  const project = activeProject.value;
  const projectId = project?.id ?? null;
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void loadContext();
  }, []);

  useEffect(() => {
    setOpen(null);
    void loadContext();
  }, [projectId]);

  if (!project) {
    return <p class="p-2 text-faint">{t("files.noProject")}</p>;
  }

  return (
    <div class="dock-view dock-fixed">
      <PanelActions>
        <button
          type="button"
          title={t("context.add")}
          onClick={() => setOpen("")}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="plus" size={12} />
        </button>
        <button
          type="button"
          title={t("context.refresh")}
          onClick={() => void loadContext()}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          <Icon name="refresh" size={12} />
        </button>
      </PanelActions>

      <div class="flex shrink-0 flex-col gap-0.5 p-2">
        {failure.value && <p class="px-1.5 text-state-failed">{failure.value}</p>}

        {entries.value.length === 0 && !failure.value && (
          <p class="px-1.5 text-faint">{t("context.empty")}</p>
        )}

        {entries.value.map((entry) => (
          <ListRow
            key={entry.key}
            label={entry.key}
            mono
            selected={open === entry.key}
            lead={<Icon name="context" size={12} class="text-faint" />}
            trail={<span class="tabular-nums">{entry.bytes}</span>}
            onClick={() => setOpen(entry.key)}
          />
        ))}
      </div>

      {open !== null && <Editor key={open} entryKey={open} onDone={() => setOpen(null)} />}
    </div>
  );
}

function Editor({ entryKey, onDone }: { entryKey: string; onDone: () => void }) {
  const fresh = entryKey === "";
  const [key, setKey] = useState(entryKey);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fresh) {
      return;
    }
    void readEntry(entryKey).then(setText);
  }, [entryKey, fresh]);

  const save = useCallback(() => {
    if (!key.trim()) {
      return;
    }
    setSaving(true);
    void writeEntry(key.trim(), text)
      .then(() => {
        setDirty(false);
        setSaving(false);
        if (fresh) {
          onDone();
        }
      })
      .catch(() => setSaving(false));
  }, [key, text, fresh, onDone]);

  return (
    <div class="flex min-h-0 flex-1 flex-col border-t border-border">
      {fresh && (
        <input
          type="text"
          value={key}
          autofocus
          placeholder={t("context.keyPlaceholder")}
          autocomplete="off"
          spellcheck={false}
          onInput={(event) => setKey(event.currentTarget.value)}
          class="shrink-0 border-b border-border bg-transparent px-2 py-1 text-text outline-none placeholder:text-faint"
        />
      )}
      <textarea
        value={text}
        placeholder={t("context.bodyPlaceholder")}
        spellcheck={false}
        onInput={(event) => {
          setText(event.currentTarget.value);
          setDirty(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            save();
          }
        }}
        class="min-h-0 w-full flex-1 resize-none bg-transparent px-2 py-1 text-text outline-none placeholder:text-faint"
      />
      <div class="flex shrink-0 items-center gap-2 px-2 pb-1.5">
        <span class="min-w-0 flex-1 truncate text-faint">
          {saving ? t("context.saving") : dirty ? t("context.unsaved") : t("context.shared")}
        </span>
        <button
          type="button"
          onClick={onDone}
          class="shrink-0 text-faint transition-colors hover:text-text"
        >
          {t("context.close")}
        </button>
        <button
          type="button"
          disabled={!dirty || !key.trim()}
          onClick={save}
          class="shrink-0 rounded border border-border px-2 py-0.5 text-muted transition-colors enabled:hover:bg-raised enabled:hover:text-text disabled:opacity-40"
        >
          {t("context.save")}
        </button>
      </div>
    </div>
  );
}
