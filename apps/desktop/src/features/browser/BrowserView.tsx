import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "preact/hooks";

import { complain } from "@/shared/daemon";

type Props = {
  id: string;
  url: string;
};

export function boxOf(node: HTMLElement) {
  const box = node.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

export function BrowserView({ id, url }: Props) {
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

  return <div ref={host} class="h-full w-full bg-pane" />;
}
