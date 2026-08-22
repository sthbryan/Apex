import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ChevronLeft, ChevronRight } from "lucide-preact";
import { Button } from "@apex/ui";

export interface CarouselProps {
  label: string;
  width: number;
  perPage?: number;
  children?: ComponentChildren;
}

export function Carousel({ label, width, perPage = 2, children }: CarouselProps) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function sync() {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }

  useEffect(sync, []);

  function page(dir: -1 | 1) {
    track.current?.scrollBy({ left: dir * (width + 16) * perPage, behavior: "smooth" });
  }

  return (
    <div class="vw-carousel" style={`--vw-item:${width}px`}>
      <div class="vw-carousel-track" ref={track} onScroll={sync} role="group" aria-label={label}>
        {children}
      </div>
      <div class="vw-carousel-nav">
        <Button variant="ghost" size="sm" iconOnly aria-label={`${label}: previous`} disabled={atStart} onClick={() => page(-1)}>
          <ChevronLeft size={14} />
        </Button>
        <Button variant="ghost" size="sm" iconOnly aria-label={`${label}: next`} disabled={atEnd} onClick={() => page(1)}>
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
