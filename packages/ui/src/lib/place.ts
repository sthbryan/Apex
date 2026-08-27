const OPTION_HEIGHT = 32;
const LIST_PADDING = 10;
const LIST_CAP = 224;

export function opensLeftward(
  trigger: { getBoundingClientRect(): { left: number; right: number } } | null,
  room: number = typeof window === "undefined" ? 0 : window.innerWidth,
): boolean {
  if (!trigger) {
    return false;
  }
  const box = trigger.getBoundingClientRect();
  return box.left > room - box.right;
}

export function clippedRoom(
  trigger: Element | null,
  fallback: number = typeof window === "undefined" ? 0 : window.innerHeight,
): number {
  if (!trigger || typeof getComputedStyle !== "function") {
    return fallback;
  }
  let node = trigger.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (style.overflowY !== "visible" || style.overflowX !== "visible") {
      return Math.min(fallback, node.getBoundingClientRect().bottom);
    }
    node = node.parentElement;
  }
  return fallback;
}

export function opensUpward(
  trigger: { getBoundingClientRect(): { top: number; bottom: number } } | null,
  count: number,
  room: number = typeof window === "undefined" ? 0 : window.innerHeight,
): boolean {
  if (!trigger) {
    return false;
  }
  const box = trigger.getBoundingClientRect();
  const wanted = Math.min(count * OPTION_HEIGHT + LIST_PADDING, LIST_CAP);
  const below = room - box.bottom;
  return below < wanted && box.top > below;
}
