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
import { useEffect, useRef, useState } from "preact/hooks";

import type { AcpDiff } from "@/bindings/AcpDiff";
import type { AcpEntry } from "@/bindings/AcpEntry";
import type { AcpPermission } from "@/bindings/AcpPermission";
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

  const toFoot = () => {
    const el = scroll.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  };

  useEffect(() => {
    if (!stale) {
      toFoot();
    }
  }, [entries.length, stale]);

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
    <div class="flex h-full flex-col bg-bg">
      <div class="relative flex min-h-0 flex-1 flex-col">
        <Transcript elRef={scroll}>
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

      <Working since={session?.state} on={working} />

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
      return (
        <Message class="acp-thought">
          <span class="whitespace-pre-wrap">{body.text}</span>
        </Message>
      );
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
  const [at, setAt] = useState(0);
  const [sent, setSent] = useState(false);
  const latest = useRef(drafts);
  latest.current = drafts;

  if (!asking(asks[0])) {
    return <Ask id={id} ask={asks[0]} />;
  }

  if (asks.every((ask) => ask.decided !== null)) {
    return (
      <>
        {asks.map((ask) => (
          <QuestionCard
            key={ask.request}
            question={ask.title}
            answer={labelOf(ask, ask.decided ?? "")}
            options={[]}
            answeredLabel={t("acp.answered")}
          />
        ))}
      </>
    );
  }

  const step = asks[Math.min(at, asks.length - 1)];
  const draft = drafts[step.request] ?? BLANK;
  const last = at >= asks.length - 1;

  const write = (next: Draft) => {
    const all = { ...latest.current, [step.request]: next };
    latest.current = all;
    setDrafts(all);
  };

  const send = (held: Record<number, Draft>) => {
    setSent(true);
    latest.current = held;
    for (const ask of asks) {
      void decide(id, ask.request, answerOf(held[ask.request]));
    }
  };

  const move = (next: Record<number, Draft>) => {
    latest.current = next;
    setDrafts(next);
    if (last) {
      send(next);
      return;
    }
    setAt(at + 1);
  };

  return (
    <QuestionCard
      question={step.title}
      picked={draft.row}
      own={draft.own}
      sent={sent}
      marks={asks.map((ask, index) => ({
        label: ask.title,
        answered: answerOf(drafts[ask.request]) !== null,
        here: index === at,
      }))}
      options={step.options.map((option) => ({
        id: option.id,
        label: option.name || option.id,
        hint: option.about ?? undefined,
      }))}
      ownLabel={t("acp.own")}
      ownPlaceholder={t("acp.ownPlaceholder")}
      skipLabel={t("acp.skip")}
      backLabel={t("acp.back")}
      submitLabel={last ? t("acp.submit") : t("acp.next")}
      sendingLabel={t("acp.sending")}
      dismissLabel={t("acp.dismissAll")}
      onPick={(row) => write({ ...draft, row })}
      onOwn={(own) => write({ ...draft, own })}
      onAnswer={() => {
        if (answerOf(latest.current[step.request]) !== null) {
          move(latest.current);
        }
      }}
      onSkip={() => move({ ...latest.current, [step.request]: BLANK })}
      onBack={at > 0 ? () => setAt(at - 1) : undefined}
      onJump={asks.length > 1 ? setAt : undefined}
      onDismiss={asks.length > 1 ? () => send(drafts) : undefined}
    />
  );
}

function Ask({ id, ask }: { id: string; ask: AcpPermission }) {
  if (ask.decided) {
    return (
      <ApprovalCard
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
      question={ask.title}
      lead={<Icon name="keyboard" size={14} />}
      actions={
        <>
          {ask.options.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={option.kind === "reject_once" ? "danger" : "primary"}
              class="max-w-64 truncate"
              title={option.name || option.id}
              onClick={() => void decide(id, ask.request, option.id)}
            >
              {option.name || option.id}
            </Button>
          ))}
          <span class="ui-approval-card-aside">
            <Button size="sm" variant="subtle" onClick={() => void decide(id, ask.request, null)}>
              {t("acp.reject")}
            </Button>
          </span>
        </>
      }
    />
  );
}

export function asking(ask: AcpPermission): boolean {
  return ask.options.every((option) => !option.kind.startsWith("allow"));
}

function Working({ since, on }: { since: string | undefined; on: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!on) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const tick = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(tick);
  }, [on, since]);

  if (!on) {
    return null;
  }

  return (
    <p class="flex shrink-0 animate-pulse items-center gap-2 border-t border-border px-3 py-1 text-state-working">
      <Icon name="activity" size={12} class="shrink-0" />
      <span>{t("acp.working", { seconds: String(seconds) })}</span>
    </p>
  );
}

function Reply({ id, working }: { id: string; working: boolean }) {
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const offered = commands.value[id] ?? [];
  const typed = /^\/(\S*)$/.exec(text);
  const matches = typed ? offered.filter((command) => command.name.startsWith(typed[1])) : [];

  const waiting = queuedIn(id);

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
        rows={3}
        label={t("acp.send")}
        placeholder={t("acp.placeholder")}
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
            <span class="min-w-0 truncate text-faint">
              {working
                ? t("acp.hintQueue")
                : offered.length > 0
                  ? t("acp.hintCommands")
                  : t("acp.hint")}
            </span>
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
  if (!picker || picker.choices.length === 0) {
    return null;
  }
  return (
    <Select
      class="max-w-40"
      label={t(kind === "model" ? "acp.model" : "acp.mode")}
      value={picker.chosen ?? undefined}
      options={picker.choices.map((choice) => ({ value: choice.id, label: choice.name }))}
      onChange={(wanted) =>
        void choose(id, kind === "model" ? wanted : null, kind === "mode" ? wanted : null)
      }
    />
  );
}

function labelOf(ask: AcpPermission, decided: string): string {
  return ask.options.find((option) => option.id === decided)?.name ?? decided;
}
