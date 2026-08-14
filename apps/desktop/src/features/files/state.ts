import { invoke } from "@tauri-apps/api/core";

import type { FileContents } from "@/bindings/FileContents";
import type { FileEntry } from "@/bindings/FileEntry";

export async function listDirectory(project: string, path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_directory", { project, path });
}

export async function readFile(project: string, path: string): Promise<FileContents> {
  return invoke<FileContents>("read_file", { project, path });
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
