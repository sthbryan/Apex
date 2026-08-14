const PANE_MIME = "application/x-apex-pane";
const TAB_MIME = "application/x-apex-tab";
const PANE_PREFIX = "apex-pane:";
const TAB_PREFIX = "apex-tab:";

export function writePaneDrag(event: DragEvent, tabId: string, leafId: string): void {
  write(event, PANE_MIME, PANE_PREFIX, `${tabId}:${leafId}`);
}

export function writeTabDrag(event: DragEvent, tabId: string): void {
  write(event, TAB_MIME, TAB_PREFIX, tabId);
}

export function hasPaneDrag(event: DragEvent): boolean {
  return has(event, PANE_MIME);
}

export function hasTabDrag(event: DragEvent): boolean {
  return has(event, TAB_MIME);
}

export function readPaneDrag(event: DragEvent): { tabId: string; leafId: string } | null {
  const raw = read(event, PANE_MIME, PANE_PREFIX);
  if (!raw) {
    return null;
  }
  const [tabId, leafId] = raw.split(":");
  return tabId && leafId ? { tabId, leafId } : null;
}

export function readTabDrag(event: DragEvent): string | null {
  return read(event, TAB_MIME, TAB_PREFIX);
}

function write(event: DragEvent, mime: string, prefix: string, value: string): void {
  if (!event.dataTransfer) {
    return;
  }
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(mime, value);
  event.dataTransfer.setData("text/plain", `${prefix}${value}`);
}

function has(event: DragEvent, mime: string): boolean {
  const types = event.dataTransfer?.types;
  return Boolean(types?.includes(mime) || types?.includes("text/plain"));
}

function read(event: DragEvent, mime: string, prefix: string): string | null {
  const raw = event.dataTransfer?.getData(mime) || event.dataTransfer?.getData("text/plain");
  if (!raw) {
    return null;
  }
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
}
