import { useEffect, useRef } from "preact/hooks";

import { detachTerminal, focusTerminal, mountTerminal, refitTerminal } from "@/features/sessions/registry";

type Props = {
  id: string;
  active: boolean;
};

export function TerminalView({ id, active }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = host.current;
    if (!container) {
      return;
    }

    mountTerminal(id, container);
    const observer = new ResizeObserver(() => refitTerminal(id));
    observer.observe(container);

    return () => {
      observer.disconnect();
      detachTerminal(id);
    };
  }, [id]);

  useEffect(() => {
    if (active) {
      refitTerminal(id);
      focusTerminal(id);
    }
  }, [active, id]);

  return <div ref={host} class="h-full w-full overflow-hidden bg-bg px-2 pt-1.5 pb-2" />;
}
