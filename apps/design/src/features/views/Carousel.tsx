import type { ComponentChildren } from "preact";
import { useRef, useState } from "preact/hooks";
import { ChevronLeft, ChevronRight } from "lucide-preact";
import { Button } from "@apex/ui";

export interface CarouselProps {
  label: string;
  children?: ComponentChildren;
}

export function Carousel({ label, children }: CarouselProps) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function sync() {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }

  function page(dir: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const step = el.querySelector<HTMLElement>(".vw-cell")?.offsetWidth ?? 260;
    el.scrollBy({ left: dir * (step + 16) * 2, behavior: "smooth" });
  }

  return (
    <div class="vw-carousel">
      <div class="vw-carousel-track" ref={track} onScroll={sync} role="group" aria-label={label}>
        {children}
      </div>
      <div class="vw-carousel-nav">
        <Button variant="ghost" size="sm" iconOnly aria-label="Previous" disabled={atStart} onClick={() => page(-1)}>
          <ChevronLeft size={14} />
        </Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Next" disabled={atEnd} onClick={() => page(1)}>
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
