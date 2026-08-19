import { useEffect, useRef } from "preact/hooks";

import {
  detachTerminal,
  focusTerminal,
  mountTerminal,
  refitTerminal,
  revealTerminal,
  spoken,
} from "@/features/sessions/registry";
import { t } from "@/shared/i18n";

type Props = {
  id: string;
  active: boolean;
};

export function TerminalView({ id, active }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const quiet = !spoken.value.has(id);

  useEffect(() => {
    const container = host.current;
    if (!container) {
      return;
    }

    void mountTerminal(id, container);
    const observer = new ResizeObserver(() => refitTerminal(id));
    observer.observe(container);

    return () => {
      observer.disconnect();
      detachTerminal(id, container);
    };
  }, [id]);

  useEffect(() => {
    if (active) {
      refitTerminal(id);
      revealTerminal(id);
      focusTerminal(id);
    }
  }, [active, id]);

  return (
    <div class="relative h-full w-full">
      <div ref={host} class="h-full w-full overflow-hidden bg-tty p-0.5" />
      {quiet && (
        <p class="pointer-events-none absolute inset-x-0 top-2 text-center text-faint">
          {t("sessions.quiet")}
        </p>
      )}
    </div>
  );
}
