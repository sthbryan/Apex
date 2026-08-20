import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "preact/hooks";

import { overlays } from "@/features/browser/state";
import { complain } from "@/shared/daemon";

type Props = {
  id: string;
  url: string;
  visible: boolean;
};

function boxOf(node: HTMLElement) {
  const box = node.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

export function BrowserView({ id, url, visible }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const label = `browser-${id}`;

  useEffect(() => {
    const node = host.current;
    if (!node) {
      return;
    }
    void invoke("browser_open", { label, url, bounds: boxOf(node) }).catch(complain);
    return () => {
      void invoke("browser_close", { label }).catch(complain);
    };
  }, [label, url]);

  useEffect(() => {
    const node = host.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(() => {
      void invoke("browser_bounds", { label, bounds: boxOf(node) }).catch(complain);
    });
    observer.observe(node);
    const onMove = () => {
      void invoke("browser_bounds", { label, bounds: boxOf(node) }).catch(complain);
    };
    window.addEventListener("resize", onMove);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onMove);
    };
  }, [label]);

  const shown = visible && overlays.value === 0;

  useEffect(() => {
    void invoke("browser_show", { label, visible: shown }).catch(complain);
  }, [label, shown]);

  return <div ref={host} class="h-full w-full bg-pane" />;
}
