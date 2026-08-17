import cn from "cnfast";

import { cancelSession, pendingSession } from "@/features/sessions/pending";
import { t } from "@/shared/i18n";
import { usePresence } from "@/shared/ui/presence";
import { Choices } from "./Choices";

export function NewSession() {
  const request = pendingSession.value;
  const overlay = usePresence<HTMLDivElement>(request !== null);

  if (!overlay.mounted) {
    return null;
  }

  return (
    <div
      ref={overlay.holder}
      class={cn(
        "fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24",
        overlay.leaving ? "animate-veil-out" : "animate-veil-in",
      )}
      onMouseDown={cancelSession}
    >
      <div
        class={cn(
          "w-96 max-w-[90vw] overflow-hidden rounded-lg border border-border bg-overlay shadow-2xl",
          overlay.leaving ? "animate-pop-out" : "animate-pop-in",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header class="border-b border-border px-3 py-2 text-code text-text">
          {t("isolation.title", { agent: request?.agent ?? "" })}
        </header>

        <Choices key={request?.id ?? 0} />
      </div>
    </div>
  );
}
