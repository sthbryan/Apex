import { useEffect } from "preact/hooks";

import { agents, connect, daemonVersion, failure, status } from "./daemon";
import { locale, setLocale, t } from "./i18n";
import { AgentList } from "./panels/AgentList";

export function App() {
  useEffect(() => {
    document.documentElement.lang = locale.value;
    void connect();
  }, []);

  return (
    <div class="flex h-full flex-col bg-bg text-text">
      <header class="flex h-9 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
        <span class="font-semibold tracking-wide">{t("app.name")}</span>
        <div class="flex items-center gap-3">
          <span class="text-faint">
            {status.value === "ready"
              ? `apexd ${daemonVersion.value ?? ""}`
              : t(`status.${status.value}`)}
          </span>
          <button
            type="button"
            class="rounded border border-border px-1.5 uppercase text-faint hover:text-text"
            onClick={() => setLocale(locale.value === "es" ? "en" : "es")}
          >
            {locale.value}
          </button>
        </div>
      </header>

      <main class="min-h-0 flex-1 overflow-auto p-4">
        {status.value === "failed" ? (
          <div class="max-w-xl">
            <p class="text-state-blocked">{t("daemon.unreachable")}</p>
            <pre class="mt-2 overflow-x-auto rounded border border-border bg-surface p-3 text-muted">
              {failure.value}
            </pre>
            <button
              type="button"
              class="mt-3 rounded border border-border px-3 py-1 hover:bg-raised"
              onClick={() => void connect()}
            >
              {t("daemon.retry")}
            </button>
          </div>
        ) : (
          <AgentList agents={agents.value} loading={status.value === "connecting"} />
        )}
      </main>
    </div>
  );
}
