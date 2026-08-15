import cn from "cnfast";
import { useEffect, useRef, useState } from "preact/hooks";

import type { AcpDiff } from "@/bindings/AcpDiff";
import type { AcpEntry } from "@/bindings/AcpEntry";
import type { AcpPermission } from "@/bindings/AcpPermission";
import type { AcpToolCall } from "@/bindings/AcpToolCall";
import type { AcpToolStatus } from "@/bindings/AcpToolStatus";
import {
  cancel,
  decide,
  entriesOf,
  failure,
  loadTranscript,
  prompt,
  transcripts,
} from "@/features/acp/state";
import { sessions } from "@/features/sessions/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function AcpView({ id }: { id: string }) {
  const entries = transcripts.value[id] ?? entriesOf(id);
  const session = sessions.value.find((candidate) => candidate.id === id);
  const working = session?.state === "working";
  const foot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadTranscript(id);
  }, [id]);

  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  return (
    <div class="flex h-full flex-col bg-bg">
      <div class="min-h-0 flex-1 overflow-auto px-3 py-2">
        {entries.length === 0 && <p class="text-faint">{t("acp.empty")}</p>}
        {entries.map((entry) => (
          <Entry key={entry.index} id={id} entry={entry} />
        ))}
        <div ref={foot} />
      </div>

      {failure.value && <p class="px-3 pb-1 text-state-failed">{failure.value}</p>}

      <Composer id={id} working={working} />
    </div>
  );
}

function Entry({ id, entry }: { id: string; entry: AcpEntry }) {
  const body = entry.body;
  switch (body.type) {
    case "user":
      return (
        <p class="mt-2 flex gap-2 whitespace-pre-wrap">
          <span class="shrink-0 select-none text-focus">›</span>
          <span class="min-w-0 text-text">{body.text}</span>
        </p>
      );
    case "agent":
      return <p class="mt-2 whitespace-pre-wrap text-text">{body.text}</p>;
    case "thought":
      return <p class="mt-2 whitespace-pre-wrap text-faint italic">{body.text}</p>;
    case "notice":
      return <p class="mt-2 whitespace-pre-wrap text-state-failed">{body.text}</p>;
    case "plan":
      return (
        <ul class="mt-2 border-l border-border pl-2">
          {body.entries.map((step) => (
            <li
              key={step.content}
              class={cn(step.status === "completed" ? "text-faint line-through" : "text-muted")}
            >
              {step.content}
            </li>
          ))}
        </ul>
      );
    case "tool":
      return <Tool call={body.call} />;
    case "permission":
      return <Ask id={id} ask={body.ask} />;
  }
}

function Tool({ call }: { call: AcpToolCall }) {
  const [open, setOpen] = useState(call.diffs.length > 0);
  const details = call.text.length > 0 || call.diffs.length > 0;

  return (
    <div class="mt-2 border border-border">
      <button
        type="button"
        disabled={!details}
        onClick={() => setOpen((shown) => !shown)}
        class="flex w-full items-center gap-2 px-2 py-0.5 text-left enabled:hover:bg-raised"
      >
        <span class={cn("shrink-0", toneOf(call.status))}>{markOf(call.status)}</span>
        <span class="min-w-0 truncate text-text">{call.title}</span>
        <span class="ml-auto shrink-0 text-faint">{call.kind}</span>
      </button>

      {open && details && (
        <div class="border-t border-border">
          {call.text && (
            <pre class="overflow-x-auto px-2 py-1 text-muted leading-5">
              <code>{call.text}</code>
            </pre>
          )}
          {call.diffs.map((diff) => (
            <Diff key={diff.path} diff={diff} />
          ))}
        </div>
      )}
    </div>
  );
}

function Diff({ diff }: { diff: AcpDiff }) {
  const removed = (diff.old_text ?? "").length > 0 ? (diff.old_text ?? "").split("\n") : [];
  const added = diff.new_text.length > 0 ? diff.new_text.split("\n") : [];

  return (
    <div class="border-t border-border first:border-t-0">
      <p class="truncate px-2 py-0.5 text-faint">{diff.path}</p>
      <pre class="overflow-x-auto px-2 pb-1 leading-5">
        <code>
          {removed.map((line, index) => (
            <div key={`old-${index}-${line}`} class="text-state-failed">
              -{line}
            </div>
          ))}
          {added.map((line, index) => (
            <div key={`new-${index}-${line}`} class="text-state-done">
              +{line}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

function Ask({ id, ask }: { id: string; ask: AcpPermission }) {
  return (
    <div
      class={cn("mt-2 border px-2 py-1", ask.decided ? "border-border" : "border-state-blocked")}
    >
      <p class="flex items-center gap-2">
        <Icon name="keyboard" size={12} class="shrink-0 text-state-blocked" />
        <span class="min-w-0 truncate text-text">{ask.title}</span>
      </p>

      {ask.decided ? (
        <p class="text-faint">{t("acp.decided", { option: labelOf(ask, ask.decided) })}</p>
      ) : (
        <div class="mt-1 flex flex-wrap items-center gap-1">
          {ask.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => void decide(id, ask.request, option.id)}
              class="border border-border px-2 text-muted transition-colors hover:bg-raised hover:text-text"
            >
              {option.name || option.id}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void decide(id, ask.request, null)}
            class="px-2 text-faint transition-colors hover:text-text"
          >
            {t("acp.reject")}
          </button>
        </div>
      )}
    </div>
  );
}

function Composer({ id, working }: { id: string; working: boolean }) {
  const [text, setText] = useState("");

  const send = () => {
    const body = text.trim();
    if (!body) {
      return;
    }
    setText("");
    void prompt(id, body);
  };

  return (
    <div class="flex shrink-0 flex-col border-t border-border">
      <textarea
        value={text}
        rows={3}
        placeholder={t("acp.placeholder")}
        spellcheck={false}
        onInput={(event) => setText(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        class="w-full resize-none bg-transparent px-3 py-1.5 text-text outline-none placeholder:text-faint"
      />
      <div class="flex items-center gap-2 px-3 pb-1.5">
        <span class="min-w-0 flex-1 truncate text-faint">{t("acp.hint")}</span>
        {working && (
          <button
            type="button"
            onClick={() => void cancel(id)}
            class="shrink-0 text-faint transition-colors hover:text-text"
          >
            {t("acp.stop")}
          </button>
        )}
        <button
          type="button"
          disabled={!text.trim()}
          onClick={send}
          class="shrink-0 border border-border px-2 text-muted transition-colors enabled:hover:bg-raised enabled:hover:text-text disabled:opacity-40"
        >
          {t("acp.send")}
        </button>
      </div>
    </div>
  );
}

function labelOf(ask: AcpPermission, decided: string): string {
  return ask.options.find((option) => option.id === decided)?.name ?? decided;
}

function markOf(status: AcpToolStatus): string {
  switch (status) {
    case "pending":
      return "○";
    case "running":
      return "◍";
    case "completed":
      return "●";
    case "failed":
      return "✕";
  }
}

function toneOf(status: AcpToolStatus): string {
  switch (status) {
    case "pending":
      return "text-faint";
    case "running":
      return "text-state-working";
    case "completed":
      return "text-state-done";
    case "failed":
      return "text-state-failed";
  }
}
