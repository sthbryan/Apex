import { useCallback, useRef, useState } from "preact/hooks";

const SLACK = 4;

export type Reorder = {
  held: string | null;
  seat: number | null;
  hold: (element: HTMLElement | null) => void;
  grab: (id: string, from: number, event: MouseEvent) => void;
};

export function useReorder(settle: (id: string, seat: number) => void): Reorder {
  const list = useRef<HTMLElement | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [seat, setSeat] = useState<number | null>(null);

  const hold = useCallback((element: HTMLElement | null) => {
    list.current = element;
  }, []);

  const grab = useCallback(
    (id: string, from: number, event: MouseEvent) => {
      if (event.button !== 0 || !list.current) {
        return;
      }

      const origin = event.clientY;
      let lifted = false;
      let landing = from;

      const drag = (moved: MouseEvent) => {
        if (!lifted && Math.abs(moved.clientY - origin) < SLACK) {
          return;
        }
        if (!lifted) {
          lifted = true;
          setHeld(id);
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }
        landing = seatOf(rowsOf(list.current), moved.clientY, from);
        setSeat(landing);
      };

      const drop = () => {
        window.removeEventListener("mousemove", drag);
        window.removeEventListener("mouseup", drop);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setHeld(null);
        setSeat(null);
        if (lifted && landing !== from) {
          settle(id, landing);
        }
      };

      window.addEventListener("mousemove", drag);
      window.addEventListener("mouseup", drop);
    },
    [settle],
  );

  return { held, seat, hold, grab };
}

function rowsOf(list: HTMLElement | null): HTMLElement[] {
  return Array.from(list?.children ?? []) as HTMLElement[];
}

function seatOf(rows: HTMLElement[], y: number, from: number): number {
  for (let index = 0; index < rows.length; index += 1) {
    const box = rows[index].getBoundingClientRect();
    if (y < box.top + box.height / 2) {
      return index > from ? index - 1 : index;
    }
  }
  return rows.length - 1;
}
