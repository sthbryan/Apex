import {
  Button,
  Dot,
  ListRow,
  Meter,
  Notice,
  Popover,
  ProcessRow,
  Readout,
  SectionLabel,
  Spark,
} from "@apex/ui";
import type { ComponentChildren } from "preact";
import type { MetricsSnapshot } from "@/bindings/MetricsSnapshot";
import type { SessionUsage } from "@/bindings/SessionUsage";
import { barTone, readoutTone } from "@/features/usage/tone";
import { focusSession } from "@/features/workspace/state";
import { t } from "@/shared/i18n";
import { compactBytes, cpuHistory, killProcess, percentOf } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  open: boolean;
  snapshot: MetricsSnapshot | null;
  anchor: ComponentChildren;
  onClose: () => void;
};

export function ResourcesPanel({ open, snapshot, anchor, onClose }: Props) {
  const system = snapshot?.system;
  const apex = snapshot?.apex;
  const sessions = snapshot?.sessions ?? [];

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      side="top"
      align="end"
      width={308}
      label={t("resources.title")}
      title={t("resources.title")}
      meta={system ? t("resources.cores", { count: String(system.cores) }) : undefined}
    >
      {!snapshot || !system || !apex ? (
        <p class="text-faint">{t("resources.sampling")}</p>
      ) : (
        <>
          <SectionLabel flush>{t("resources.cpu")}</SectionLabel>
          <Readout
            value={`${system.cpu_percent.toFixed(0)}%`}
            tone={readoutTone(system.cpu_percent)}
            note={t("resources.apexHint")}
          />
          <Spark points={cpuHistory.value} max={100} label={t("resources.cpu")} />

          <Meter
            lead={<Icon name="sparkles" />}
            label={t("resources.apex")}
            value={apex.cpu_percent}
            tone={barTone(apex.cpu_percent)}
            detail={compactBytes(apex.memory)}
          />
          <Meter
            lead={<Icon name="memory" />}
            label={t("resources.memory")}
            value={percentOf(system.memory_used, system.memory_total)}
            tone={barTone(percentOf(system.memory_used, system.memory_total))}
            detail={`${compactBytes(system.memory_used)}/${compactBytes(system.memory_total)}`}
          />
          {system.gpu_percent !== null && (
            <Meter
              lead={<Icon name="gpu" />}
              label={t("resources.gpu")}
              value={system.gpu_percent}
              tone={barTone(system.gpu_percent)}
            />
          )}
          {system.swap_total > 0 && (
            <Meter
              lead={<Icon name="swap" />}
              label={t("resources.swap")}
              value={percentOf(system.swap_used, system.swap_total)}
              tone={barTone(percentOf(system.swap_used, system.swap_total))}
              detail={`${compactBytes(system.swap_used)}/${compactBytes(system.swap_total)}`}
            />
          )}

          <SectionLabel flush count={sessions.length}>
            {t("resources.bySession")}
          </SectionLabel>
          {sessions.length === 0 ? (
            <Notice>{t("resources.noSessions")}</Notice>
          ) : (
            sessions.map((usage) => <Session key={usage.id} usage={usage} />)
          )}
        </>
      )}
    </Popover>
  );
}

function Session({ usage }: { usage: SessionUsage }) {
  return (
    <div>
      <ListRow
        label={usage.title}
        lead={<Dot state="working" />}
        trail={
          <span class="font-mono">
            {compactBytes(usage.memory)} · {usage.cpu_percent.toFixed(0)}%
          </span>
        }
        onClick={() => focusSession(usage.id)}
      />
      {usage.processes.slice(0, 3).map((process) => (
        <ProcessRow
          key={process.pid}
          command={process.name}
          pid={process.pid}
          mem={compactBytes(process.memory)}
          actions={
            <Button
              variant="subtle"
              size="xs"
              iconOnly
              title={t("resources.kill", { pid: String(process.pid) })}
              aria-label={t("resources.kill", { pid: String(process.pid) })}
              onClick={() => void killProcess(process.pid)}
            >
              <Icon name="close" size={11} />
            </Button>
          }
        />
      ))}
    </div>
  );
}
