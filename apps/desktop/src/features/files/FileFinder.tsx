import { useEffect, useState } from "preact/hooks";

import type { FileEntry } from "@/bindings/FileEntry";
import { searchFiles } from "@/features/files/state";
import { activeProject } from "@/features/projects/state";
import { openFile } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { Picker, type PickerItem } from "@/shared/ui/Picker";

const LIMIT = 60;
const DEBOUNCE = 90;

export function FileFinder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projectId = activeProject.value?.id ?? null;
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FileEntry[]>([]);

  useEffect(() => {
    if (open) {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !projectId) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchFiles(projectId, query, LIMIT).then((entries) => {
        if (!cancelled) {
          setFound(entries);
        }
      });
    }, DEBOUNCE);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, projectId, query]);

  const items: PickerItem[] = found.map((entry) => ({
    id: entry.path,
    label: entry.name,
    hint: entry.path,
    run: () => {
      onClose();
      openFile(entry.path);
    },
  }));

  return (
    <Picker
      open={open}
      onClose={onClose}
      query={query}
      onQuery={setQuery}
      placeholder={t("files.findPlaceholder")}
      items={items}
    />
  );
}
