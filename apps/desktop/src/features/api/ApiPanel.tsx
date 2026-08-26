import { Button, Pane, SectionLabel, Segmented, Select } from "@apex/ui";
import cn from "cnfast";
import { useEffect, useState } from "preact/hooks";

import type { ApiRun } from "@/bindings/ApiRun";
import type { ApiVariable } from "@/bindings/ApiVariable";
import { type BodyKind, bodyKind, KINDS, laidOut } from "@/features/api/body";
import { runHeaders, type Shown, shownBody } from "@/features/api/run";
import {
  brokenJson,
  chosen,
  closeEnvironment,
  dirty,
  draft,
  edit,
  editing,
  environment,
  environments,
  fields,
  headers,
  last,
  layOut,
  loadCollection,
  METHODS,
  names,
  openEnvironment,
  openRequest,
  params,
  removeEnvironment,
  removeRequest,
  saveEnvironment,
  saveRequest,
  sending,
  sendRequest,
  setEnvironment,
  setFields,
  setHeaders,
  setKind,
  setParams,
  setVariables,
  startEnvironment,
  startNew,
  tone,
  trouble,
  variables,
} from "@/features/api/state";
import type { Pair } from "@/features/api/url";
import { paint } from "@/features/files/highlight";
import { activeProjectId } from "@/features/projects/state";
import { complain } from "@/shared/daemon";
import { type MessageKey, t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";

type Tab = "params" | "headers" | "body";

const BOX =
  "min-w-0 rounded-sm border border-border bg-raised px-2 text-sm text-text placeholder:text-faint focus:border-focus focus:outline-none";
const LINE = `h-(--apex-h-md) ${BOX}`;
const FLOW = "w-full whitespace-pre-wrap break-words font-mono text-xs leading-relaxed";

const TONES = {
  ok: "text-state-done",
  warn: "text-state-working",
  bad: "text-state-failed",
} as const;

const KIND_LABELS: Record<BodyKind, MessageKey> = {
  none: "api.bodyNone",
  json: "api.bodyJson",
  text: "api.bodyText",
  form: "api.bodyForm",
} as const;

export function ApiPanel() {
  const project = activeProjectId.value;
  const [wanted, setWanted] = useState("");
  const [tab, setTab] = useState<Tab>("params");

  useEffect(() => {
    void loadCollection().catch(complain);
  }, [project]);

  if (!project) {
    return <p class="p-3 text-faint text-sm">{t("files.noProject")}</p>;
  }

  const request = draft.value;
  const run = last.value;
  const name = chosen.value;
  const unsaved = dirty();
  const query = params();
  const sent = headers();
  const kind = bodyKind(request);

  const keep = (as: string) => {
    const trimmed = as.trim();
    if (!trimmed) {
      return;
    }
    void saveRequest(trimmed)
      .then(() => setWanted(""))
      .catch(complain);
  };

  const add = () => {
    if (tab === "params") {
      setParams([...query, { key: t("api.rowKey"), value: "" }]);
    } else {
      setHeaders([...sent, { key: t("api.rowKey"), value: "" }]);
    }
  };

  return (
    <Pane
      scroll={false}
      class="h-full"
      lead={<Icon name="send" size={12} class="shrink-0 text-faint" />}
      title={name ?? t("api.title")}
      sub={name && unsaved ? t("api.unsaved") : null}
      controls={
        <>
          <Step icon="plus" hint={t("api.new")} onPick={startNew} />
          {name && (
            <Step
              icon="close"
              hint={t("api.remove")}
              onPick={() => void removeRequest(name).catch(complain)}
            />
          )}
        </>
      }
    >
      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-3 pb-4">
        <Select
          class="w-full"
          label={t("api.request")}
          placeholder={t("api.pickRequest")}
          value={name ?? ""}
          options={names.value.map((saved) => ({ value: saved, label: saved }))}
          onChange={(picked) => void openRequest(picked).catch(complain)}
        />

        <div class="flex gap-1.5">
          <span class="shrink-0" style="--ui-select-width: 88px">
            <Select
              label={t("api.method")}
              value={request.method}
              options={METHODS.map((method) => ({ value: method, label: method }))}
              onChange={(method) => edit({ method })}
            />
          </span>
          <input
            value={request.url}
            spellcheck={false}
            placeholder="https://{{host}}/users"
            onInput={(event) => edit({ url: event.currentTarget.value })}
            class={cn(LINE, "flex-1 font-mono text-xs")}
          />
        </div>

        <div class="flex gap-1.5">
          <Select
            class="min-w-0 flex-1"
            label={t("api.environment")}
            placeholder={t("api.noEnvironment")}
            value={environment.value ?? ""}
            options={environments.value.map((found) => ({ value: found, label: found }))}
            onChange={setEnvironment}
          />
          <Step
            icon="pencil"
            hint={t("api.editEnvironment")}
            onPick={() => {
              const open = environment.value;
              if (editing.value !== null) {
                closeEnvironment();
              } else if (open) {
                void openEnvironment(open).catch(complain);
              } else {
                startEnvironment();
              }
            }}
          />
          {name ? (
            <Button
              size="md"
              variant={unsaved ? "ghost" : "subtle"}
              disabled={!unsaved}
              onClick={() => keep(name)}
            >
              {t("api.save")}
            </Button>
          ) : (
            <>
              <input
                value={wanted}
                placeholder={t("api.name")}
                onInput={(event) => setWanted(event.currentTarget.value)}
                onKeyDown={(event) => event.key === "Enter" && keep(wanted)}
                class={cn(LINE, "w-24 shrink-0")}
              />
              <Button size="md" disabled={!wanted.trim()} onClick={() => keep(wanted)}>
                {t("api.save")}
              </Button>
            </>
          )}
          <Button
            size="md"
            variant="primary"
            disabled={!name || sending.value}
            onClick={() => void sendRequest()}
          >
            {sending.value ? t("api.sending") : t("api.send")}
          </Button>
        </div>

        {editing.value !== null && <Stage />}

        <section class="flex min-w-0 flex-col gap-1.5">
          <div class="flex items-center justify-between gap-1.5">
            <Segmented
              class="min-w-0"
              label={t("api.section")}
              value={tab}
              onChange={setTab}
              options={[
                { value: "params", label: <Tally text={t("api.params")} count={query.length} /> },
                { value: "headers", label: <Tally text={t("api.headers")} count={sent.length} /> },
                {
                  value: "body",
                  label: <Tally text={t("api.body")} note={t(KIND_LABELS[kind])} />,
                },
              ]}
            />
            {tab !== "body" && (
              <Step
                icon="plus"
                hint={tab === "params" ? t("api.addParam") : t("api.addHeader")}
                onPick={add}
              />
            )}
          </div>

          {tab === "params" && (
            <Rows
              pairs={query}
              onChange={setParams}
              empty={t("api.noParams")}
              hint={t("api.dropParam")}
            />
          )}
          {tab === "headers" && (
            <Rows
              pairs={sent}
              onChange={setHeaders}
              empty={t("api.noHeaders")}
              hint={t("api.dropHeader")}
            />
          )}
          {tab === "body" && <Body kind={kind} />}
        </section>

        {trouble.value && (
          <p class="rounded-sm border border-state-failed px-2 py-1.5 text-state-failed text-xs">
            {trouble.value}
          </p>
        )}

        {run && <Answer run={run} />}
      </div>
    </Pane>
  );
}

function Stage() {
  const held = editing.value ?? "";
  const [named, setNamed] = useState(held);
  const rows = variables.value;
  const name = held || named.trim();

  const swap = (at: number, one: ApiVariable) =>
    setVariables(rows.map((was, i) => (i === at ? one : was)));

  return (
    <section class="flex min-w-0 flex-col gap-1.5 rounded-sm border border-border p-2">
      <div class="flex items-center justify-between gap-1.5">
        {held ? (
          <span class="min-w-0 flex-1 truncate font-medium text-sm text-text">{held}</span>
        ) : (
          <input
            value={named}
            spellcheck={false}
            placeholder={t("api.environmentName")}
            onInput={(event) => setNamed(event.currentTarget.value)}
            class={cn(LINE, "min-w-0 flex-1")}
          />
        )}
        <Step
          icon="plus"
          hint={t("api.addVariable")}
          onPick={() =>
            setVariables([...rows, { name: t("api.rowKey"), value: "", secret: false }])
          }
        />
        <Step icon="close" hint={t("api.closeEnvironment")} onPick={closeEnvironment} />
      </div>

      {rows.length === 0 ? (
        <p class="text-faint text-xs">{t("api.noVariables")}</p>
      ) : (
        rows.map((one, at) => (
          <div key={at} class="flex items-center gap-1.5">
            <input
              value={one.name}
              spellcheck={false}
              placeholder={t("api.rowKey")}
              onBlur={(event) => swap(at, { ...one, name: event.currentTarget.value.trim() })}
              class={cn(LINE, "w-2/5 font-mono text-xs")}
            />
            <input
              value={one.value}
              spellcheck={false}
              type={one.secret ? "password" : "text"}
              placeholder={one.secret ? t("api.kept") : t("api.rowValue")}
              onInput={(event) => swap(at, { ...one, value: event.currentTarget.value })}
              class={cn(LINE, "flex-1 font-mono text-xs")}
            />
            <Step
              icon="secret"
              on={one.secret}
              hint={t("api.secret")}
              onPick={() => swap(at, { ...one, secret: !one.secret })}
            />
            <Step
              icon="close"
              hint={t("api.dropVariable")}
              onPick={() => setVariables(rows.filter((_, i) => i !== at))}
            />
          </div>
        ))
      )}

      <div class="flex items-center gap-1.5">
        <Button
          size="md"
          variant="primary"
          disabled={!name}
          onClick={() => void saveEnvironment(name).catch(complain)}
        >
          {t("api.save")}
        </Button>
        {held && (
          <Button
            size="md"
            variant="ghost"
            onClick={() => void removeEnvironment(held).catch(complain)}
          >
            {t("api.remove")}
          </Button>
        )}
        <p class="min-w-0 flex-1 text-right text-faint text-xs">{t("api.secretHint")}</p>
      </div>
    </section>
  );
}

function Answer({ run }: { run: ApiRun }) {
  const [tab, setTab] = useState<"body" | "headers">("body");
  const sent = runHeaders(run);
  const shown = shownBody(run);

  return (
    <section class="flex min-w-0 flex-col gap-1.5">
      <SectionLabel
        flush
        action={
          <span class="flex items-center gap-2 font-mono text-xs">
            <span class={TONES[tone(run.status)]}>{run.status}</span>
            <span class="text-faint">{run.millis}ms</span>
            <span class="text-faint">{bytes(run.size)}</span>
          </span>
        }
      >
        {t("api.response")}
      </SectionLabel>
      <Segmented
        size="sm"
        class="min-w-0 self-start"
        label={t("api.response")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "body", label: t("api.body") },
          { value: "headers", label: <Tally text={t("api.headers")} count={sent.length} /> },
        ]}
      />
      {tab === "body" ? (
        <Answered shown={shown} />
      ) : (
        <dl class="flex min-w-0 flex-col gap-1 rounded-sm border border-border bg-raised p-2 font-mono text-xs">
          {sent.map(({ key, value }) => (
            <div key={key} class="flex min-w-0 gap-2">
              <dt class="w-2/5 shrink-0 truncate text-faint" title={key}>
                {key}
              </dt>
              <dd class="min-w-0 flex-1 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Answered({ shown }: { shown: Shown }) {
  const markup = usePainted(shown);
  const box =
    "max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border bg-raised p-2 font-mono text-xs leading-relaxed";

  if (markup === null) {
    return <pre class={box}>{shown.text}</pre>;
  }
  return (
    <pre class={box}>
      <code dangerouslySetInnerHTML={{ __html: markup }} />
    </pre>
  );
}

function usePainted(shown: Shown): string | null {
  const [ready, setReady] = useState<{ text: string; markup: string | null } | null>(null);

  useEffect(() => {
    if (!shown.json) {
      return;
    }
    let live = true;
    void paint("json", shown.text).then((markup) => {
      if (live) {
        setReady({ text: shown.text, markup });
      }
    });
    return () => {
      live = false;
    };
  }, [shown.json, shown.text]);

  return ready?.text === shown.text ? ready.markup : null;
}

function Body({ kind }: { kind: BodyKind }) {
  const rows = fields();
  const broken = brokenJson();

  return (
    <div class="flex min-w-0 flex-col gap-1.5">
      <div class="flex items-center justify-between gap-1.5">
        <Segmented
          size="sm"
          class="min-w-0"
          label={t("api.bodyKind")}
          value={kind}
          onChange={setKind}
          options={KINDS.map((one) => ({ value: one, label: t(KIND_LABELS[one]) }))}
        />
        {kind === "form" && (
          <Step
            icon="plus"
            hint={t("api.addField")}
            onPick={() => setFields([...rows, { key: t("api.rowKey"), value: "" }])}
          />
        )}
        {kind === "json" && (
          <Step
            icon="braces"
            hint={t("api.layOut")}
            off={laidOut(draft.value.body ?? "") === null}
            onPick={layOut}
          />
        )}
      </div>

      {kind === "none" && <p class="text-faint text-xs">{t("api.noBody")}</p>}
      {kind === "form" && (
        <Rows
          pairs={rows}
          onChange={setFields}
          empty={t("api.noFields")}
          hint={t("api.dropField")}
        />
      )}
      {kind === "text" && (
        <textarea
          rows={8}
          value={draft.value.body ?? ""}
          spellcheck={false}
          placeholder={t("api.bodyHint")}
          onInput={(event) => edit({ body: event.currentTarget.value })}
          class={cn(BOX, "w-full resize-y py-1.5 font-mono text-xs leading-relaxed")}
        />
      )}
      {kind === "json" && <Sheet text={draft.value.body ?? ""} broken={broken !== null} />}
      {broken && <p class="text-state-failed text-xs">{broken}</p>}
    </div>
  );
}

function Sheet({ text, broken }: { text: string; broken: boolean }) {
  const markup = usePainted({ text, json: !broken });

  return (
    <div class={cn(BOX, "relative py-1.5", broken && "border-state-failed")}>
      <pre aria-hidden class={cn(FLOW, "min-h-24 text-text")}>
        {markup === null ? (
          <code>{text}</code>
        ) : (
          <code dangerouslySetInnerHTML={{ __html: markup }} />
        )}
        {"\n"}
      </pre>
      <textarea
        value={text}
        spellcheck={false}
        autocapitalize="off"
        autocomplete="off"
        placeholder={t("api.bodyHint")}
        onInput={(event) => edit({ body: event.currentTarget.value })}
        class={cn(
          FLOW,
          "absolute inset-0 resize-none overflow-hidden border-0 bg-transparent px-2 py-1.5 text-transparent caret-text outline-none placeholder:text-faint",
        )}
      />
    </div>
  );
}

function Rows({
  pairs,
  onChange,
  empty,
  hint,
}: {
  pairs: Pair[];
  onChange: (pairs: Pair[]) => void;
  empty: string;
  hint: string;
}) {
  if (pairs.length === 0) {
    return <p class="text-faint text-xs">{empty}</p>;
  }

  const swap = (at: number, pair: Pair) => onChange(pairs.map((was, i) => (i === at ? pair : was)));

  return (
    <>
      {pairs.map((pair, at) => (
        <div key={at} class="flex items-center gap-1.5">
          <input
            value={pair.key}
            spellcheck={false}
            placeholder={t("api.rowKey")}
            onBlur={(event) => swap(at, { ...pair, key: event.currentTarget.value.trim() })}
            class={cn(LINE, "w-2/5 font-mono text-xs")}
          />
          <input
            value={pair.value}
            spellcheck={false}
            placeholder={t("api.rowValue")}
            onInput={(event) => swap(at, { ...pair, value: event.currentTarget.value })}
            class={cn(LINE, "flex-1 font-mono text-xs")}
          />
          <Step
            icon="close"
            hint={hint}
            onPick={() => onChange(pairs.filter((_, i) => i !== at))}
          />
        </div>
      ))}
    </>
  );
}

function Tally({ text, count, note }: { text: string; count?: number; note?: string }) {
  return (
    <span class="flex items-center gap-1">
      {text}
      {count ? <span class="text-faint">{count}</span> : null}
      {note ? <span class="text-faint">{note}</span> : null}
    </span>
  );
}

function bytes(size: number): string {
  return size < 1024 ? `${size} B` : `${Math.round(size / 1024)} kB`;
}

function Step({
  icon,
  hint,
  onPick,
  off,
  on,
}: {
  icon: IconName;
  hint: string;
  onPick: () => void;
  off?: boolean;
  on?: boolean;
}) {
  return (
    <button
      type="button"
      title={hint}
      disabled={off}
      onClick={onPick}
      aria-pressed={on}
      class={cn(
        "flex size-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-raised hover:text-text disabled:pointer-events-none disabled:opacity-40",
        on ? "text-accent" : "text-faint",
      )}
    >
      <Icon name={icon} size={12} />
    </button>
  );
}
