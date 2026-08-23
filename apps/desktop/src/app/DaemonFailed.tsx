import { TitleBar } from "@apex/ui";
import { connect, failure, stale } from "@/shared/daemon";
import { t } from "@/shared/i18n";

export function DaemonFailed() {
  return (
    <div class="flex h-full flex-col bg-bg text-text">
      <TitleBar
        data-tauri-drag-region
        lights={false}
        style={{ paddingLeft: "max(var(--apex-controls-start, 0px), 12px)" }}
      />
      <main class="flex-1 overflow-auto p-4">
        <p class="text-state-blocked">
          {stale.value ? t("daemon.stale") : t("daemon.unreachable")}
        </p>
        {stale.value && <p class="mt-1 text-muted">{t("daemon.staleHint")}</p>}
        <pre class="mt-2 max-w-xl overflow-x-auto rounded border border-border bg-surface p-3 text-muted">
          {failure.value}
        </pre>
        <button
          type="button"
          class="mt-3 rounded border border-border px-3 py-1 hover:bg-raised"
          onClick={() => void connect()}
        >
          {t("daemon.retry")}
        </button>
      </main>
    </div>
  );
}
