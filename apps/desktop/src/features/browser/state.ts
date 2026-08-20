import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

export const overlays = signal(0);

export function useOverlay(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    overlays.value += 1;
    return () => {
      overlays.value -= 1;
    };
  }, [active]);
}
