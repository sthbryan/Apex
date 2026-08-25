import { Button, Pane, Select } from "@apex/ui";
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

const TONES = {
  ok: "text-state-done",
  warn: "text-state-working",
  bad: "text-state-failed",
} as const;

export function ApiPanel() {
  const project = activeProjectId.value;
  const [naming, setNaming] = useState(false);
  const [wanted, setWanted] = useState("");

  useEffect(() => {
    void loadCollection().catch(complain);
  }, [project]);

  if (!project) {
    return <p class="p-3 text-faint">{t("files.noProject")}</p>;
  }

  const request = draft.value;
  const run = last.value;
  const unsaved = dirty();

  const keep = (name: string) => {
    void saveRequest(name.trim())
      .then(() => {
        setNaming(false);
        setWanted("");
      })
      .catch(complain);
  };

  return (
    <Pane
      wide
      scroll={false}
      class="h-full"
      lead={<Icon name="send" size={12} class="shrink-0 text-faint" />}
      title={
        <Select
          class="min-w-0 flex-1"
          label={t("api.request")}
          placeholder={t("api.pickRequest")}
          value={chosen.value ?? undefined}
          options={names.value.map((name) => ({ value: name, label: name }))}
          onChange={(name) => void openRequest(name).catch(complain)}
        />
      }
      controls={
        <>
          <Step icon="plus" hint={t("api.new")} onPick={startNew} />
          {chosen.value && (
            <Step
              icon="close"
              hint={t("api.remove")}
              onPick={() => void removeRequest(chosen.value ?? "").catch(complain)}
            />
          )}
        </>
      }
    >
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
        <div class="flex gap-1">
          <Select
            class="w-28 shrink-0"
            label={t("api.method")}
            value={request.method}
            options={METHODS.map((method) => ({ value: method, label: method }))}
            onChange={(method) => edit({ method })}
          />
          <input
            value={request.url}
            placeholder="https://{{host}}/users"
            onInput={(event) => edit({ url: event.currentTarget.value })}
            class="min-w-0 flex-1 rounded border border-border bg-raised px-2 py-1 font-mono text-xs"
          />
        </div>

        <div class="flex items-center gap-1">
          <Select
            class="min-w-0 flex-1"
            label={t("api.environment")}
            placeholder={t("api.noEnvironment")}
            value={environment.value ?? undefined}
            options={environments.value.map((name) => ({ value: name, label: name }))}
            onChange={setEnvironment}
          />
          {naming || !chosen.value ? (
            <div class="flex shrink-0 items-center gap-1">
              <input
                value={wanted}
                placeholder={t("api.name")}
                onInput={(event) => setWanted(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && wanted.trim()) {
                    keep(wanted);
                  }
                }}
                class="w-24 rounded border border-border bg-raised px-2 py-1 text-xs"
              />
              <Button size="xs" disabled={!wanted.trim()} onClick={() => keep(wanted)}>
                {t("api.save")}
              </Button>
            </div>
          ) : (
            <Button
              size="xs"
              variant={unsaved ? "primary" : "subtle"}
              onClick={() => keep(chosen.value ?? "")}
            >
              {t("api.save")}
            </Button>
          )}
          <Button
            size="xs"
            variant="primary"
            disabled={!chosen.value || sending.value}
            onClick={() => void sendRequest()}
          >
            {sending.value ? t("api.sending") : t("api.send")}
          </Button>
        </div>

        <Headers headers={request.headers} />

        <label class="flex flex-col gap-1">
          <span class="text-faint text-xs">{t("api.body")}</span>
          <textarea
            rows={5}
            value={request.body ?? ""}
            onInput={(event) => edit({ body: event.currentTarget.value || null })}
            class="w-full resize-y rounded border border-border bg-raised px-2 py-1 font-mono text-xs"
          />
        </label>

        {trouble.value && (
          <p class="rounded border border-state-failed px-2 py-1 text-state-failed text-xs">
            {trouble.value}
          </p>
        )}

        {run && (
          <div class="flex min-h-0 flex-col gap-1">
            <div class="flex items-center gap-2 text-xs">
              <span class={cn("font-mono", TONES[tone(run.status)])}>{run.status}</span>
              <span class="text-faint">{run.millis}ms</span>
              <span class="text-faint">{run.size}B</span>
              {run.truncated && <span class="text-state-working">{t("api.cut")}</span>}
            </div>
            <pre class="max-h-64 overflow-auto rounded border border-border bg-raised p-2 font-mono text-xs">
              {shortBody(run)}
            </pre>
          </div>
        )}
      </div>
    </Pane>
  );
}

function Headers({ headers }: { headers: Record<string, string> }) {
  const rows = Object.entries(headers);
  return (
    <div class="flex flex-col gap-1">
      <span class="text-faint text-xs">{t("api.headers")}</span>
      {rows.map(([key, value]) => (
        <div key={key} class="flex gap-1">
          <input
            value={key}
            onBlur={(event) => setHeader(event.currentTarget.value.trim(), value, key)}
            class="w-1/3 min-w-0 rounded border border-border bg-raised px-2 py-1 font-mono text-xs"
          />
          <input
            value={value}
            onInput={(event) => setHeader(key, event.currentTarget.value)}
            class="min-w-0 flex-1 rounded border border-border bg-raised px-2 py-1 font-mono text-xs"
          />
          <button
            type="button"
            title={t("api.dropHeader")}
            onClick={() => dropHeader(key)}
            class="flex size-6 shrink-0 items-center justify-center rounded text-faint hover:bg-raised hover:text-text"
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
      <Button size="xs" variant="subtle" onClick={() => setHeader("new-header", "")}>
        {t("api.addHeader")}
      </Button>
    </div>
  );
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
