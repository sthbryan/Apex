import { useEffect, useRef, useState } from "preact/hooks";

export function usePresence<T extends HTMLElement>(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const holder = useRef<T>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const node = holder.current;
    if (!node) {
      setMounted(false);
      return;
    }
    let cancelled = false;
    const running = node
      .getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY)
      .map((animation) => animation.finished);
    void Promise.allSettled(running).then(() => {
      if (!cancelled) {
        setMounted(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return { mounted, leaving: mounted && !open, holder };
}
