import { signal } from "@preact/signals";

import type { Direction } from "@/features/workspace/tree";

export type DropEdge = "left" | "right" | "top" | "bottom";

export type PaneDrag = { tabId: string; leafId: string };

export const draggedPane = signal<PaneDrag | null>(null);

export const EDGE_DIRECTION: Record<DropEdge, Direction> = {
  left: "row-reverse",
  right: "row",
  top: "column-reverse",
  bottom: "column",
};

export function edgeAt(rect: DOMRect, x: number, y: number): DropEdge {
  const offsetX = (x - rect.left) / rect.width - 0.5;
  const offsetY = (y - rect.top) / rect.height - 0.5;
  if (Math.abs(offsetX) >= Math.abs(offsetY)) {
    return offsetX < 0 ? "left" : "right";
  }
  return offsetY < 0 ? "top" : "bottom";
}

export const EDGE_CLASS: Record<DropEdge, string> = {
  left: "inset-y-0 left-0 w-1/2",
  right: "inset-y-0 right-0 w-1/2",
  top: "inset-x-0 top-0 h-1/2",
  bottom: "inset-x-0 bottom-0 h-1/2",
};
