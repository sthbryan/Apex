import { computed, signal } from "@preact/signals";

const MAX_BUFFERS = 64;

export type Buffer = {
  project: string;
  path: string;
  text: string;
  revision: string | null;
  opened: number;
};

export const buffers = signal<Record<string, Buffer>>({});

export const dirtyKeys = computed(() => new Set(Object.keys(buffers.value)));

export function bufferKey(project: string, path: string): string {
  return `${project}:${path}`;
}

export function readBuffer(project: string, path: string): Buffer | null {
  return buffers.value[bufferKey(project, path)] ?? null;
}

export function keepBuffer(
  project: string,
  path: string,
  text: string,
  revision: string | null,
): void {
  const key = bufferKey(project, path);
  const opened = buffers.value[key]?.opened ?? Date.now();
  buffers.value = prune({ ...buffers.value, [key]: { project, path, text, revision, opened } });
}

export function dropBuffer(project: string, path: string): void {
  const key = bufferKey(project, path);
  if (!buffers.value[key]) {
    return;
  }
  const next = { ...buffers.value };
  delete next[key];
  buffers.value = next;
}

function prune(pool: Record<string, Buffer>): Record<string, Buffer> {
  const next = { ...pool };
  while (Object.keys(next).length > MAX_BUFFERS) {
    const oldest = Object.entries(next).reduce((left, right) =>
      left[1].opened <= right[1].opened ? left : right,
    );
    delete next[oldest[0]];
  }
  return next;
}
