import { Button, EmptyState, TitleBar } from "@apex/ui";
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
      <main class="flex min-h-0 flex-1 flex-col overflow-auto">
        <EmptyState
          title={stale.value ? t("daemon.stale") : t("daemon.unreachable")}
          detail={stale.value ? t("daemon.staleHint") : undefined}
          actions={
            <Button variant="primary" onClick={() => void connect()}>
              {t("daemon.retry")}
            </Button>
          }
        />
        <pre class="mx-auto max-w-xl overflow-x-auto rounded border border-border bg-surface p-3 text-muted">
          {failure.value}
        </pre>
      </main>
    </div>
  );
}
