import { useState } from "preact/hooks";
import { Gauge } from "@/features/resources/Gauge";
import { ResourcesPanel } from "@/features/resources/ResourcesPanel";
import { compactBytes, metrics } from "@/shared/telemetry";

const BUSY_CPU = 25;

export function ResourcesSummary() {
  const [open, setOpen] = useState(false);
  const snapshot = metrics.value;

  if (!snapshot) {
    return <div />;
  }

  return (
    <ResourcesPanel
      open={open}
      snapshot={snapshot}
      onClose={() => setOpen(false)}
      anchor={
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          class="flex items-center gap-3 rounded px-1 transition-colors hover:bg-raised hover:text-muted"
        >
          {snapshot.apex.cpu_percent >= BUSY_CPU && (
            <Gauge icon="sparkles" value={`${snapshot.apex.cpu_percent.toFixed(0)}%`} />
          )}
          <Gauge icon="memory" value={compactBytes(snapshot.apex.memory)} />
        </button>
      }
    />
  );
}
