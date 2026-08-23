import { Modal } from "@apex/ui";
import cn from "cnfast";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { WorktreeDisposal } from "@/bindings/WorktreeDisposal";
import { useOverlay } from "@/features/browser/state";
import { cancelClose, finishClose, pendingClose } from "@/features/sessions/pending";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";

const CHOICES: { value: WorktreeDisposal; icon: IconName }[] = [
  { value: "keep", icon: "branch" },
  { value: "discard", icon: "close" },
];

export function CloseSession() {
  const request = pendingClose.value;
  useOverlay(request !== null);

  return (
    <Modal
      open={request !== null}
      onClose={cancelClose}
      width="sm"
      title={t("closing.title", { title: request?.title ?? "" })}
    >
      <Choices key={request?.id ?? 0} />
    </Modal>
  );
}

function Choices() {
  const [cursor, setCursor] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const branch = pendingClose.value?.branch ?? "";
  const list = useRef<HTMLDivElement>(null);

  const confirm = useCallback((disposal: WorktreeDisposal) => {
    const current = pendingClose.value;
    if (!current) {
      return;
    }
    void finishClose(current.sessionId, disposal).catch((error: unknown) =>
      setFailure(String(error)),
    );
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!pendingClose.value) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((current) => (current + 1) % CHOICES.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((current) => (current - 1 + CHOICES.length) % CHOICES.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        confirm(CHOICES[cursor].value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, confirm]);

  useEffect(() => {
    list.current?.querySelector<HTMLButtonElement>(`[data-cursor='${cursor}']`)?.focus();
  }, [cursor]);

  return (
    <>
      <div ref={list} class="flex flex-col">
        {CHOICES.map((option, index) => (
          <button
            key={option.value}
            type="button"
            data-cursor={index}
            onMouseEnter={() => setCursor(index)}
            onClick={() => confirm(option.value)}
            class={cn(
              "group flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-1.5 text-left outline-none transition-colors",
              index === cursor ? "bg-raised" : "hover:bg-raised",
            )}
          >
            <span
              class={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                index === cursor ? "border-accent" : "border-border",
              )}
            >
              {index === cursor && <span class="size-1.5 rounded-full bg-accent" />}
            </span>
            <Icon name={option.icon} size={14} class="shrink-0 text-faint" />
            <span class="min-w-0">
              <span class="block text-md text-text">{t(`closing.${option.value}`)}</span>
              <span class="block text-xs text-faint">
                {t(`closing.${option.value}Hint`, { branch })}
              </span>
            </span>
          </button>
        ))}
      </div>

      {failure && <p class="pt-2 text-xs text-state-failed">{failure}</p>}
    </>
  );
}
