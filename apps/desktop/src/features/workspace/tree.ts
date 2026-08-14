import type { GitTarget } from "@/bindings/GitTarget";

export type Direction = "row" | "column";

export type PaneView =
  | { type: "session"; sessionId: string }
  | { type: "file"; path: string }
  | { type: "diff"; target: GitTarget; path: string; commit: string | null }
  | { type: "panel"; panel: string };

export type Leaf = {
  kind: "leaf";
  id: string;
  view: PaneView;
};

export type Split = {
  kind: "split";
  id: string;
  direction: Direction;
  ratio: number;
  first: PaneNode;
  second: PaneNode;
};

export type PaneNode = Leaf | Split;

const MIN_RATIO = 0.1;
const MAX_RATIO = 0.9;

export function newId(): string {
  return crypto.randomUUID();
}

export function leaf(view: PaneView): Leaf {
  return { kind: "leaf", id: newId(), view };
}

export function sessionOf(node: Leaf): string | null {
  return node.view.type === "session" ? node.view.sessionId : null;
}

export function referencedSession(node: Leaf): string | null {
  if (node.view.type === "session") {
    return node.view.sessionId;
  }
  if (node.view.type === "diff" && node.view.target.type === "session") {
    return node.view.target.id;
  }
  return null;
}

export function leaves(node: PaneNode): Leaf[] {
  return node.kind === "leaf" ? [node] : [...leaves(node.first), ...leaves(node.second)];
}

export function swapViews(node: PaneNode, leftId: string, rightId: string): PaneNode {
  const left = findLeaf(node, leftId);
  const right = findLeaf(node, rightId);
  if (!left || !right) {
    return node;
  }
  return setView(setView(node, leftId, right.view), rightId, left.view);
}

export function setView(node: PaneNode, leafId: string, view: PaneView): PaneNode {
  if (node.kind === "leaf") {
    return node.id === leafId ? { ...node, view } : node;
  }
  return {
    ...node,
    first: setView(node.first, leafId, view),
    second: setView(node.second, leafId, view),
  };
}

export function findLeaf(node: PaneNode, leafId: string): Leaf | null {
  if (node.kind === "leaf") {
    return node.id === leafId ? node : null;
  }
  return findLeaf(node.first, leafId) ?? findLeaf(node.second, leafId);
}

export function splitLeaf(
  node: PaneNode,
  targetId: string,
  direction: Direction,
  incoming: Leaf,
): PaneNode {
  if (node.kind === "leaf") {
    if (node.id !== targetId) {
      return node;
    }
    return { kind: "split", id: newId(), direction, ratio: 0.5, first: node, second: incoming };
  }
  return {
    ...node,
    first: splitLeaf(node.first, targetId, direction, incoming),
    second: splitLeaf(node.second, targetId, direction, incoming),
  };
}

export function removeLeaf(node: PaneNode, leafId: string): PaneNode | null {
  if (node.kind === "leaf") {
    return node.id === leafId ? null : node;
  }
  const first = removeLeaf(node.first, leafId);
  const second = removeLeaf(node.second, leafId);
  if (first === null) {
    return second;
  }
  if (second === null) {
    return first;
  }
  return { ...node, first, second };
}

export function setRatio(node: PaneNode, splitId: string, ratio: number): PaneNode {
  if (node.kind === "leaf") {
    return node;
  }
  if (node.id === splitId) {
    return { ...node, ratio: clampRatio(ratio) };
  }
  return {
    ...node,
    first: setRatio(node.first, splitId, ratio),
    second: setRatio(node.second, splitId, ratio),
  };
}

export function clampRatio(ratio: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

export function neighbourLeaf(node: PaneNode, leafId: string): Leaf | null {
  const all = leaves(node);
  const index = all.findIndex((candidate) => candidate.id === leafId);
  if (index === -1) {
    return null;
  }
  return all[index + 1] ?? all[index - 1] ?? null;
}
