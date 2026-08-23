import type { SessionUsage } from "@/bindings/SessionUsage";
import { focusSession } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { compactBytes, killProcess } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  sessions: SessionUsage[];
};

export function SessionSection({ sessions }: Props) {
  const sessionMemory = sessions.reduce((total, session) => total + session.memory, 0);
  const sessionCpu = sessions.reduce((total, session) => total + session.cpu_percent, 0);

  return (
    <section class="border-t border-border px-2.5 py-1">
      <header class="mb-0.5 flex items-baseline gap-1">
        <h3 class="text-xs uppercase tracking-wider text-faint">{t("resources.bySession")}</h3>
        {sessions.length > 0 && (
          <span class="truncate text-2xs text-faint">
            {t("resources.sessionSummary", {
              count: String(sessions.length),
              memory: compactBytes(sessionMemory),
              cpu: sessionCpu.toFixed(0),
            })}
          </span>
        )}
      </header>
      {sessions.length === 0 ? (
        <p class="text-xs text-faint">{t("resources.noSessions")}</p>
      ) : (
        <ul class="flex flex-col text-xs">
          {sessions.map((usage) => (
            <li key={usage.id} class="animate-row-in">
              <button
                type="button"
                onClick={() => focusSession(usage.id)}
                class="flex w-full items-center gap-2 rounded px-1 text-left transition-colors hover:bg-raised"
              >
                <span class="truncate">{usage.title}</span>
                <span class="ml-auto shrink-0 text-muted">{compactBytes(usage.memory)}</span>
                <span class="w-7 shrink-0 text-right text-faint">
                  {usage.cpu_percent.toFixed(0)}%
                </span>
              </button>
              {usage.processes.slice(0, 3).map((process) => (
                <div
                  key={process.pid}
                  class="group flex items-center gap-2 rounded px-1 pl-3 text-2xs text-faint transition-colors hover:bg-raised"
                >
                  <span class="truncate">{process.name}</span>
                  <span class="ml-auto shrink-0">{compactBytes(process.memory)}</span>
                  <button
                    type="button"
                    title={t("resources.kill", { pid: String(process.pid) })}
                    onClick={() => void killProcess(process.pid)}
                    class="w-8 shrink-0 opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-state-failed"
                  >
                    <Icon name="close" size={12} class="ml-auto" />
                  </button>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
