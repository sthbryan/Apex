import { useCallback, useState } from "preact/hooks";

const SLACK = 4;

export type Reorder = {
  held: string | null;
  seat: number | null;
  grab: (id: string, from: number, event: MouseEvent) => void;
};

export function useReorder(settle: (id: string, seat: number) => void): Reorder {
  const [held, setHeld] = useState<string | null>(null);
  const [seat, setSeat] = useState<number | null>(null);

  const grab = useCallback(
    (id: string, from: number, event: MouseEvent) => {
      const list = (event.currentTarget as HTMLElement | null)?.closest("[data-reorder]");
      if (event.button !== 0 || !list) {
        return;
      }

      const origin = event.clientY;
      let lifted = false;
      let landing = from;
      document.body.style.userSelect = "none";

      const drag = (moved: MouseEvent) => {
        if (!lifted && Math.abs(moved.clientY - origin) < SLACK) {
          return;
        }
        if (!lifted) {
          lifted = true;
          setHeld(id);
          document.body.style.cursor = "grabbing";
          document.getSelection()?.removeAllRanges();
        }
        landing = seatOf(seatsOf(list), moved.clientY, from);
        setSeat(landing);
      };

      const drop = () => {
        window.removeEventListener("mousemove", drag);
        window.removeEventListener("mouseup", drop);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setHeld(null);
        setSeat(null);
        if (!lifted) {
          return;
        }
        window.addEventListener("click", swallow, { capture: true, once: true });
        if (landing !== from) {
          settle(id, landing);
        }
      };

      window.addEventListener("mousemove", drag);
      window.addEventListener("mouseup", drop);
    },
    [settle],
  );

  return { held, seat, grab };
}

function swallow(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

function seatsOf(list: Element): HTMLElement[] {
  return Array.from(list.querySelectorAll<HTMLElement>("[data-seat]"));
}

function seatOf(seats: HTMLElement[], y: number, from: number): number {
  for (let index = 0; index < seats.length; index += 1) {
    const box = seats[index].getBoundingClientRect();
    if (y < box.top + box.height / 2) {
      return index > from ? index - 1 : index;
    }
  }
  return seats.length - 1;
}
