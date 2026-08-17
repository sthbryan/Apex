import cn from "cnfast";
import { useEffect, useState } from "preact/hooks";

import type { WorktreeDisposal } from "@/bindings/WorktreeDisposal";
import { cancelClose, finishClose, pendingClose } from "@/features/sessions/pending";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";

const CHOICES: { value: WorktreeDisposal; icon: IconName }[] = [
  { value: "keep", icon: "branch" },
  { value: "discard", icon: "close" },
];

export function CloseSession() {
  const request = pendingClose.value;
  const overlay = usePresence<HTMLDivElement>(request !== null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (pendingClose.value && event.key === "Escape") {
        event.preventDefault();
        cancelClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!overlay.mounted) {
    return null;
  }

  return (
    <div
      ref={overlay.holder}
      class={cn(
        "fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-32",
        overlay.leaving ? "animate-veil-out" : "animate-veil-in",
      )}
      onMouseDown={cancelClose}
    >
      <div
        class={cn(
          "w-100 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-overlay shadow-2xl",
          overlay.leaving ? "animate-pop-out" : "animate-pop-in",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header class="border-b border-border px-4 py-2.5 text-text">
          {t("closing.title", { title: request?.title ?? "" })}
        </header>
        <Choices key={request?.id ?? 0} />
      </div>
    </div>
  );
}

function Choices() {
  const [choice, setChoice] = useState<WorktreeDisposal>("keep");
  const [failure, setFailure] = useState<string | null>(null);
  const branch = pendingClose.value?.branch ?? "";

  const confirm = (disposal: WorktreeDisposal) => {
    const current = pendingClose.value;
    if (!current) {
      return;
    }
    void finishClose(current.sessionId, disposal).catch((error: unknown) =>
      setFailure(String(error)),
    );
  };

  return (
    <>
      <div class="flex flex-col gap-1 p-2">
        {CHOICES.map((option) => (
          <button
            key={option.value}
            type="button"
            autofocus={option.value === choice}
            onMouseEnter={() => setChoice(option.value)}
            onClick={() => confirm(option.value)}
            class={cn(
              "flex items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
              option.value === choice ? "bg-raised" : "hover:bg-raised",
            )}
          >
            <Icon name={option.icon} class="mt-0.5 shrink-0 text-faint" />
            <span class="min-w-0">
              <span class="block text-text">{t(`closing.${option.value}`)}</span>
              <span class="block text-faint">{t(`closing.${option.value}Hint`, { branch })}</span>
            </span>
          </button>
        ))}
      </div>

      {failure && <p class="px-4 pb-3 text-state-failed">{failure}</p>}
    </>
  );
}
