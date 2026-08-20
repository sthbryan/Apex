import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";

import type { FileContents } from "@/bindings/FileContents";
import type { FileEntry } from "@/bindings/FileEntry";

export const tree = signal<Record<string, FileEntry[]>>({});
export const expanded = signal<string[]>([]);
export const treeFailure = signal<string | null>(null);

const SVG_VIEW = "apex.svg-view";

export type SvgView = "preview" | "source";

export const svgView = signal<SvgView>(
  (localStorage.getItem(SVG_VIEW) as SvgView | null) ?? "preview",
);

export function setSvgView(view: SvgView): void {
  svgView.value = view;
  localStorage.setItem(SVG_VIEW, view);
}

export function isSvg(path: string): boolean {
  return path.toLowerCase().endsWith(".svg");
}

export function svgSource(text: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(text)}`;
}

let loadedProject: string | null = null;

export async function listDirectory(project: string, path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_directory", { project, path });
}

export async function openTree(project: string): Promise<void> {
  if (loadedProject === project) {
    return;
  }
  loadedProject = project;
  tree.value = {};
  expanded.value = [];
  await loadDirectory(project, "");
}

export async function refreshTree(project: string): Promise<void> {
  const open = expanded.value;
  tree.value = {};
  await Promise.all(["", ...open].map((path) => loadDirectory(project, path)));
}

export async function toggleDirectory(project: string, path: string): Promise<void> {
  if (expanded.value.includes(path)) {
    expanded.value = expanded.value.filter((open) => open !== path);
    return;
  }
  expanded.value = [...expanded.value, path];
  if (!tree.value[path]) {
    await loadDirectory(project, path);
  }
}

async function loadDirectory(project: string, path: string): Promise<void> {
  try {
    const entries = await listDirectory(project, path);
    treeFailure.value = null;
    tree.value = { ...tree.value, [path]: entries };
  } catch (error) {
    treeFailure.value = String(error);
  }
}

export async function searchFiles(
  project: string,
  query: string,
  limit: number,
): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("search_files", { project, query, limit }).catch(() => []);
}

export async function readFile(project: string, path: string): Promise<FileContents> {
  return invoke<FileContents>("read_file", { project, path });
}

export async function writeFile(
  project: string,
  path: string,
  text: string,
  revision: string | null,
): Promise<string> {
  return invoke<string>("write_file", { project, path, text, revision });
}

export function isStaleWrite(error: unknown): boolean {
  return String(error).startsWith("Conflict:");
}

export function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
