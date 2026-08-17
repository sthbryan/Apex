import cn from "cnfast";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { Isolation } from "@/bindings/Isolation";
import { cancelSession, pendingSession, startSession } from "@/features/sessions/pending";
import { modeOf } from "@/features/settings/agentMode";
import { agents, complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { slugify, suggestName } from "./naming";

const CHOICES: { value: Isolation; icon: IconName }[] = [
  { value: "directory", icon: "files" },
  { value: "worktree", icon: "branch" },
];

export function Choices() {
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
    if (cursor === 1) {
      field.current?.focus();
    } else {
      list.current?.querySelector<HTMLButtonElement>("[data-cursor='0']")?.focus();
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
