import cn from "cnfast";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { Isolation } from "@/bindings/Isolation";
import { cancelSession, pendingSession, startSession } from "@/features/sessions/pending";
import { modeOf } from "@/features/settings/agentMode";
import { agents, complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";

const CHOICES: { value: Isolation; icon: IconName }[] = [
  { value: "directory", icon: "files" },
  { value: "worktree", icon: "branch" },
];

function Choices() {
  const [cursor, setCursor] = useState(0);
  const [name, setName] = useState(suggestName(pendingSession.value?.agent ?? ""));
  const [failure, setFailure] = useState<string | null>(null);
  const profile = agents.value.find((candidate) => candidate.name === pendingSession.value?.agent);
  const mode = modeOf(pendingSession.value?.agent ?? "", profile?.mode ?? "pty");
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const confirm = useCallback(
    (isolation: Isolation) => {
      const current = pendingSession.value;
      if (!current) {
        return;
      }
      const slug = isolation === "worktree" ? name.trim() || null : null;
      void startSession(current, isolation, slug, mode).catch((error: unknown) => {
        setFailure(String(error));
        complain(error);
      });
    },
    [name, mode],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!pendingSession.value) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelSession();
        return;
      }
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
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
    if (cursor === 0) {
      field.current?.focus();
    } else {
      list.current?.querySelector<HTMLButtonElement>("[data-cursor='1']")?.focus();
    }
  }, [cursor]);

  return (
    <>
      <div ref={list} class="flex flex-col p-1">
        {CHOICES.map((option, index) => (
          <button
            key={option.value}
            type="button"
            data-cursor={index}
            onMouseEnter={() => setCursor(index)}
            onClick={() => confirm(option.value)}
            class={cn(
              "group flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-1.5 text-left transition-colors",
              index === cursor ? "border-border bg-raised" : "hover:bg-raised",
            )}
          >
            <span
              class={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border",
                index === cursor ? "border-state-done text-state-done" : "border-faint text-faint",
              )}
            >
              {index === cursor && <Icon name="check" size={10} />}
            </span>
            <Icon name={option.icon} size={14} class="shrink-0 text-faint" />
            <span class="min-w-0">
              <span class="block text-code text-text">{t(`isolation.${option.value}`)}</span>
              <span class="block text-micro text-faint">{t(`isolation.${option.value}Hint`)}</span>
            </span>
          </button>
        ))}
      </div>

      {CHOICES[cursor].value === "worktree" && (
        <label class="flex flex-col gap-0.5 px-3 pb-2">
          <span class="text-micro text-faint">{t("isolation.name")}</span>
          <input
            ref={field}
            type="text"
            value={name}
            autocomplete="off"
            spellcheck={false}
            onInput={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirm("worktree");
              }
            }}
            class="rounded border border-border bg-raised px-2 py-1 text-code text-text outline-none placeholder:text-faint focus:border-muted"
          />
          <span class="text-[10px] text-faint">
            {t("isolation.branch", { branch: `apex/${slugify(name)}` })}
          </span>
        </label>
      )}

      {failure && <p class="px-3 pb-2 text-micro text-state-failed">{failure}</p>}
    </>
  );
}

function suggestName(agent: string): string {
  const when = new Date();
  const stamp = `${String(when.getMonth() + 1).padStart(2, "0")}${String(when.getDate()).padStart(2, "0")}`;
  return `${agent}-${stamp}`;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "…"
  );
}

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
          "w-96 max-w-[90vw] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl",
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
