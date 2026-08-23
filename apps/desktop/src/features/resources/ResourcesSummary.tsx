import { Bar, StatusPill } from "@apex/ui";
import { useState } from "preact/hooks";
import { ResourcesPanel } from "@/features/resources/ResourcesPanel";
import { barTone } from "@/features/usage/tone";
import { t } from "@/shared/i18n";
import { compactBytes, metrics } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";

export function ResourcesSummary() {
  const [open, setOpen] = useState(false);
  const snapshot = metrics.value;

  if (!snapshot) {
    return <div />;
  }

  const cpu = snapshot.apex.cpu_percent;

  return (
    <ResourcesPanel
      open={open}
      snapshot={snapshot}
      onClose={() => setOpen(false)}
      anchor={
        <StatusPill title={t("resources.title")} onClick={() => setOpen((current) => !current)}>
          <Icon name="sparkles" size={11} />
          <Bar class="w-9" size="sm" value={cpu} tone={barTone(cpu)} label={t("resources.cpu")} />
          <span class="font-mono tabular-nums">{compactBytes(snapshot.apex.memory)}</span>
        </StatusPill>
      }
    />
  );
}
