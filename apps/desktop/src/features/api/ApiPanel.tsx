import { Button, Pane, SectionLabel, Select } from "@apex/ui";
import cn from "cnfast";
import { useEffect, useState } from "preact/hooks";

import {
  chosen,
  dirty,
  draft,
  dropHeader,
  edit,
  environment,
  environments,
  last,
  loadCollection,
  METHODS,
  names,
  openRequest,
  removeRequest,
  saveRequest,
  sending,
  sendRequest,
  setEnvironment,
  setHeader,
  shortBody,
  startNew,
  tone,
  trouble,
} from "@/features/api/state";
import { activeProjectId } from "@/features/projects/state";
import { complain } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const BOX =
  "min-w-0 rounded-sm border border-border bg-raised px-2 text-sm text-text placeholder:text-faint focus:border-focus focus:outline-none";
const LINE = `h-(--apex-h-md) ${BOX}`;

const TONES = {
  ok: "text-state-done",
  warn: "text-state-working",
  bad: "text-state-failed",
} as const;

export function ApiPanel() {
  const project = activeProjectId.value;
  const [wanted, setWanted] = useState("");

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
  const headers = Object.entries(request.headers);

  const keep = (as: string) => {
    const trimmed = as.trim();
    if (!trimmed) {
      return;
    }
    void saveRequest(trimmed)
      .then(() => setWanted(""))
      .catch(complain);
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

        <section class="flex flex-col gap-1.5">
          <SectionLabel
            flush
            count={headers.length || undefined}
            action={
              <Step icon="plus" hint={t("api.addHeader")} onPick={() => setHeader("header", "")} />
            }
          >
            {t("api.headers")}
          </SectionLabel>
          {headers.length === 0 ? (
            <p class="px-0.5 text-faint text-xs">{t("api.noHeaders")}</p>
          ) : (
            headers.map(([key, value]) => (
              <div key={key} class="flex gap-1.5">
                <input
                  value={key}
                  spellcheck={false}
                  onBlur={(event) => setHeader(event.currentTarget.value.trim(), value, key)}
                  class={cn(LINE, "w-2/5 font-mono text-xs")}
                />
                <input
                  value={value}
                  spellcheck={false}
                  onInput={(event) => setHeader(key, event.currentTarget.value)}
                  class={cn(LINE, "flex-1 font-mono text-xs")}
                />
                <Step icon="close" hint={t("api.dropHeader")} onPick={() => dropHeader(key)} />
              </div>
            ))
          )}
        </section>

        <section class="flex flex-col gap-1.5">
          <SectionLabel flush>{t("api.body")}</SectionLabel>
          <textarea
            rows={6}
            value={request.body ?? ""}
            spellcheck={false}
            placeholder={t("api.bodyHint")}
            onInput={(event) => edit({ body: event.currentTarget.value || null })}
            class={cn(BOX, "w-full resize-y py-1.5 font-mono text-xs leading-relaxed")}
          />
        </section>

        {trouble.value && (
          <p class="rounded-sm border border-state-failed px-2 py-1.5 text-state-failed text-xs">
            {trouble.value}
          </p>
        )}

        {run && (
          <section class="flex flex-col gap-1.5">
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
            <pre class="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border bg-raised p-2 font-mono text-xs leading-relaxed">
              {shortBody(run)}
            </pre>
          </section>
        )}
      </div>
    </Pane>
  );
}

function bytes(size: number): string {
  return size < 1024 ? `${size} B` : `${Math.round(size / 1024)} kB`;
}

function Step({
  icon,
  hint,
  onPick,
}: {
  icon: "plus" | "close";
  hint: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      title={hint}
      onClick={onPick}
      class="flex size-5 shrink-0 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
    >
      <Icon name={icon} size={12} />
    </button>
  );
}
