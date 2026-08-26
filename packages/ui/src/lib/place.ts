const OPTION_HEIGHT = 32;
const LIST_PADDING = 10;
const LIST_CAP = 224;

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
