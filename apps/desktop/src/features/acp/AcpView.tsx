import {
  ApprovalCard,
  Button,
  Composer as KitComposer,
  Message,
  OWN,
  QuestionCard,
  Select,
  ToolCall,
  type ToolStatus,
  Transcript,
} from "@apex/ui";
import cn from "cnfast";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { AcpDiff } from "@/bindings/AcpDiff";
import type { AcpEntry } from "@/bindings/AcpEntry";
import type { AcpPermission } from "@/bindings/AcpPermission";
import type { AcpPicker } from "@/bindings/AcpPicker";
import type { AcpToolCall } from "@/bindings/AcpToolCall";
import type { AcpToolStatus } from "@/bindings/AcpToolStatus";
import {
  cancel,
  choose,
  commands,
  decide,
  drain,
  entriesOf,
  failure,
  laidOut,
  loadTranscript,
  models,
  modes,
  prompt,
  queue,
  queuedIn,
  transcripts,
  unqueue,
} from "@/features/acp/state";
import { SplitPatch } from "@/features/git/SplitPatch";
import { sessions } from "@/features/sessions/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const TOOL_STATUS: Record<AcpToolStatus, ToolStatus> = {
  pending: "pending",
  running: "running",
  completed: "ok",
  failed: "failed",
};

export function AcpView({ id }: { id: string }) {
  const entries = transcripts.value[id] ?? entriesOf(id);
  const session = sessions.value.find((candidate) => candidate.id === id);
  const working = session?.state === "working";
  const scroll = useRef<HTMLDivElement>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    void loadTranscript(id);
  }, [id]);

  useEffect(() => {
    const el = scroll.current;
    if (!el) {
      return;
    }
    const onScroll = () => {
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setStale(!bottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const following = useRef(true);
  following.current = !stale && working;

  const toFoot = useCallback(() => {
    const el = scroll.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (!stale) {
      toFoot();
    }
  }, [entries.length, stale, toFoot]);

  useEffect(() => {
    const el = scroll.current;
    if (!el || typeof MutationObserver === "undefined") {
      return;
    }
    const watch = new MutationObserver(() => {
      if (following.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    watch.observe(el, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, []);

  return (
    <div class="acp-view flex h-full flex-col bg-bg">
      <div class="relative flex min-h-0 flex-1 flex-col">
        <Transcript elRef={scroll} class="acp-transcript">
          {entries.length === 0 && <p class="text-faint">{t("acp.empty")}</p>}
          {laidOut(entries).map((shown) =>
            shown.kind === "ask" ? (
              <Asked key={`ask-${shown.at}`} id={id} asks={shown.asks} />
            ) : (
              <Entry key={shown.at} id={id} entry={shown.entry} />
            ),
          )}
        </Transcript>

        {stale && (
          <button
            type="button"
            onClick={() => {
              toFoot();
              setStale(false);
            }}
            class="absolute right-3 bottom-2 z-10 flex animate-drop-in items-center gap-1 rounded-full border border-border bg-float px-2 py-1 text-2xs text-faint shadow-lg transition-colors hover:text-text"
          >
            <Icon name="pull" size={12} />
            {t("acp.latest")}
          </button>
        )}
      </div>

      {failure.value && <p class="px-3 pb-1 text-state-failed">{failure.value}</p>}

      <Reply id={id} working={working} />
    </div>
  );
}

function Entry({ id, entry }: { id: string; entry: AcpEntry }) {
  const body = entry.body;
  const clock = <Clock at={entry.at} />;
  switch (body.type) {
    case "user":
      return (
        <Message
          from="user"
          meta={
            <>
              {t("acp.you")} {clock}
            </>
          }
        >
          <span class="whitespace-pre-wrap">{body.text}</span>
        </Message>
      );
    case "agent":
      return (
        <Message meta={clock}>
          <span class="whitespace-pre-wrap">{body.text}</span>
        </Message>
      );
    case "thought":
      return <Thought text={body.text} />;
    case "notice":
      return (
        <Message class="acp-notice">
          <span class="whitespace-pre-wrap">{body.text}</span>
        </Message>
      );
    case "plan":
      return (
        <ul class="border-l border-border pl-2">
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
      return <Asked id={id} asks={[body.ask]} />;
  }
}

function Thought({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section class="acp-thought" data-open={open || undefined}>
      <button type="button" onClick={() => setOpen((shown) => !shown)} aria-expanded={open}>
        <Icon name="activity" size={12} />
        <span>{t("acp.thought")}</span>
        <span class="acp-thought-chevron" aria-hidden="true" />
      </button>
      <div class="acp-thought-fold">
        <p class="whitespace-pre-wrap">{text}</p>
      </div>
    </section>
  );
}

export function spellClock(at: number, now: number = Date.now()): string {
  if (!at) {
    return "";
  }
  const when = new Date(at);
  const same = new Date(now).toDateString() === when.toDateString();
  const time = when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return same
    ? time
    : `${when.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

function Clock({ at }: { at: number }) {
  const shown = spellClock(at);
  if (!shown) {
    return null;
  }
  return (
    <time class="tabular-nums" dateTime={new Date(at).toISOString()}>
      {shown}
    </time>
  );
}

function Tool({ call }: { call: AcpToolCall }) {
  const [open, setOpen] = useState(call.diffs.length > 0);
  const details = call.text.length > 0 || call.diffs.length > 0;

  return (
    <ToolCall
      name={call.kind}
      command={call.title}
      status={TOOL_STATUS[call.status]}
      open={open}
      onToggle={details ? () => setOpen((shown) => !shown) : undefined}
    >
      {call.text && <pre class="overflow-x-auto leading-5">{call.text}</pre>}
      {call.diffs.map((diff) => (
        <Diff key={diff.path} diff={diff} />
      ))}
    </ToolCall>
  );
}

function Diff({ diff }: { diff: AcpDiff }) {
  const removed = (diff.old_text ?? "").length > 0 ? (diff.old_text ?? "").split("\n") : [];
  const added = diff.new_text.length > 0 ? diff.new_text.split("\n") : [];
  if (removed.length === 0 && added.length === 0) {
    return null;
  }
  const patch = [
    `@@ -1,${removed.length} +1,${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join("\n");

  return (
    <div class="border-t border-border first:border-t-0">
      <p class="truncate py-0.5 text-faint">{diff.path}</p>
      <SplitPatch path={diff.path} patch={patch} />
    </div>
  );
}

type Draft = { row: string | null; own: string };

const BLANK: Draft = { row: null, own: "" };

function answerOf(draft: Draft | undefined): string | null {
  if (!draft || draft.row === null) {
    return null;
  }
  if (draft.row !== OWN) {
    return draft.row;
  }
  const typed = draft.own.trim();
  return typed.length > 0 ? typed : null;
}

function Asked({ id, asks }: { id: string; asks: AcpPermission[] }) {
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [sentFor, setSentFor] = useState(0);
  const latest = useRef(drafts);
  latest.current = drafts;
  const sent = sentFor === asks.length;

  if (!asking(asks[0])) {
    return <Ask id={id} ask={asks[0]} />;
  }

  const done = asks.every((ask) => ask.decided !== null);

  const shown = asks.map((ask) => {
    const draft = drafts[ask.request] ?? BLANK;
    return {
      id: String(ask.request),
      question: ask.title,
      answer: ask.decided === null ? null : spellAnswer(ask, ask.decided),
      picked: draft.row,
      own: draft.own,
      options: ask.options.map((option) => ({
        id: option.id,
        label: option.name || option.id,
        hint: option.about ?? undefined,
      })),
    };
  });

  const write = (request: number, next: Draft) => {
    const all = { ...latest.current, [request]: next };
    latest.current = all;
    setDrafts(all);
  };

  const send = (held: Record<number, Draft>) => {
    setSentFor(asks.length);
    latest.current = held;
    for (const ask of asks) {
      void decide(id, ask.request, answerOf(held[ask.request]));
    }
  };

  return (
    <QuestionCard
      questions={shown}
      at={done ? -1 : 0}
      simultaneous={!done}
      sent={sent}
      headingLabel={t("acp.howMany", { count: String(asks.length) })}
      ownLabel={t("acp.own")}
      ownPlaceholder={t("acp.ownPlaceholder")}
      skipLabel={t("acp.skip")}
      submitLabel={t("acp.submit")}
      sendingLabel={t("acp.sending")}
      dismissLabel={t("acp.dismissAll")}
      onPick={(who, row) => {
        const request = Number(who);
        write(request, { ...(drafts[request] ?? BLANK), row });
      }}
      onOwn={(who, own) => {
        const request = Number(who);
        write(request, { ...(drafts[request] ?? BLANK), own });
      }}
      onAnswer={() => {
        if (asks.some((ask) => answerOf(latest.current[ask.request]) !== null)) {
          send(latest.current);
        }
      }}
      onSkip={() => send(latest.current)}
      onDismiss={asks.length > 1 ? () => send(latest.current) : undefined}
    />
  );
}

function spellAnswer(ask: AcpPermission, decided: string): string {
  return decided === "cancelled" ? t("acp.noAnswer") : labelOf(ask, decided);
}

function Ask({ id, ask }: { id: string; ask: AcpPermission }) {
  if (ask.decided) {
    return (
      <ApprovalCard
        class="acp-permission"
        settled
        question={ask.title}
        meta={t("acp.decided", { option: labelOf(ask, ask.decided) })}
        lead={<Icon name="keyboard" size={14} />}
        actions={null}
      />
    );
  }

  return (
    <ApprovalCard
      class="acp-permission"
      question={t("acp.permission")}
      command={ask.title}
      lead={<Icon name="keyboard" size={14} />}
      actions={
        <>
          {ask.options.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={
                option.kind === "allow_once"
                  ? "primary"
                  : option.kind.startsWith("reject")
                    ? "danger"
                    : "subtle"
              }
              class="max-w-64 truncate"
              title={option.name || option.id}
              onClick={() => void decide(id, ask.request, option.id)}
            >
              {option.name || option.id}
            </Button>
          ))}
          {!ask.options.some((option) => option.kind.startsWith("reject")) && (
            <Button
              size="sm"
              variant="subtle"
              class="acp-dismiss"
              onClick={() => void decide(id, ask.request, null)}
            >
              {t("acp.reject")}
            </Button>
          )}
        </>
      }
    />
  );
}

export function asking(ask: AcpPermission): boolean {
  return ask.options.every((option) => !option.kind.startsWith("allow"));
}

function Reply({ id, working }: { id: string; working: boolean }) {
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const offered = commands.value[id] ?? [];
  const typed = /^\/(\S*)$/.exec(text);
  const matches = typed ? offered.filter((command) => command.name.startsWith(typed[1])) : [];

  const waiting = queuedIn(id);

  useEffect(() => {
    setSeconds(0);
    if (!working) {
      return;
    }
    const started = Date.now();
    const tick = window.setInterval(
      () => setSeconds(Math.round((Date.now() - started) / 1000)),
      500,
    );
    return () => window.clearInterval(tick);
  }, [id, working]);

  useEffect(() => {
    if (!working && waiting.length > 0) {
      void drain(id);
    }
  }, [id, working, waiting.length]);

  const send = () => {
    const body = text.trim();
    if (!body) {
      return;
    }
    setText("");
    if (working) {
      queue(id, body);
      return;
    }
    void prompt(id, body);
  };

  const pick = (name: string) => {
    setText(`/${name} `);
    setCursor(0);
    field.current?.focus();
  };

  return (
    <div class="relative shrink-0 border-t border-border">
      {waiting.length > 0 && (
        <ul class="flex flex-col gap-1 border-b border-border px-3 py-2">
          {waiting.map((held, index) => (
            <li key={`${index}-${held}`} class="flex items-center gap-2 text-2xs text-muted">
              <span class="shrink-0 text-faint">{t("acp.queued")}</span>
              <span class="min-w-0 flex-1 truncate">{held}</span>
              <button
                type="button"
                aria-label={t("acp.unqueue")}
                onClick={() => unqueue(id, index)}
                class="shrink-0 text-faint hover:text-text"
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {matches.length > 0 && (
        <ul class="absolute right-0 bottom-full left-0 max-h-48 overflow-auto border-t border-border bg-float">
          {matches.map((command, index) => (
            <li key={command.name}>
              <button
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => pick(command.name)}
                class={cn(
                  "flex w-full items-baseline gap-2 px-3 py-0.5 text-left",
                  index === cursor ? "bg-raised" : "hover:bg-raised",
                )}
              >
                <span class="shrink-0 text-text">/{command.name}</span>
                <span class="min-w-0 truncate text-faint">{command.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <KitComposer
        class="reply"
        elRef={field}
        value={text}
        rows={1}
        label={t("acp.send")}
        placeholder={t(working ? "acp.placeholderQueue" : "acp.placeholder")}
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        onInput={(event) => {
          setText(event.currentTarget.value);
          setCursor(0);
        }}
        onKeyDown={(event) => {
          if (matches.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((current) => (current + 1) % matches.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((current) => (current - 1 + matches.length) % matches.length);
              return;
            }
            if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
              event.preventDefault();
              pick(matches[cursor].name);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setText("");
              return;
            }
          }
          if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        lead={
          <>
            <Choices id={id} kind="model" />
            <Choices id={id} kind="mode" />
            {working ? (
              <span class="acp-reply-status" role="status">
                <span class="acp-reply-status-dot" />
                {t("acp.working", { seconds: String(seconds) })}
              </span>
            ) : offered.length > 0 ? (
              <span class="acp-reply-command-hint">/ {t("acp.commands")}</span>
            ) : null}
          </>
        }
        actions={
          <>
            {working && (
              <Button size="sm" variant="danger" onClick={() => void cancel(id)}>
                {t("acp.stop")}
              </Button>
            )}
            <Button type="submit" size="sm" variant="primary" disabled={!text.trim()}>
              {working ? t("acp.queueIt") : t("acp.send")}
            </Button>
          </>
        }
      />
    </div>
  );
}

function Choices({ id, kind }: { id: string; kind: "model" | "mode" }) {
  const picker = (kind === "model" ? models.value : modes.value)[id];
  if (!picker) {
    return null;
  }
  const choices = pickerChoices(picker);
  if (choices.length === 0) {
    return null;
  }
  return (
    <Select
      class="max-w-40"
      label={t(kind === "model" ? "acp.model" : "acp.mode")}
      value={picker.chosen ?? undefined}
      options={choices.map((choice) => ({ value: choice.id, label: choice.name }))}
      onChange={(wanted) =>
        void choose(id, kind === "model" ? wanted : null, kind === "mode" ? wanted : null)
      }
    />
  );
}

export function pickerChoices(picker: AcpPicker): AcpPicker["choices"] {
  if (picker.choices.length > 0 || picker.chosen === null) {
    return picker.choices;
  }
  return [{ id: picker.chosen, name: picker.chosen }];
}

function labelOf(ask: AcpPermission, decided: string): string {
  return ask.options.find((option) => option.id === decided)?.name ?? decided;
}
