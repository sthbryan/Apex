import { GitChip } from "@/features/git/GitChip";
import { NotifyChip } from "@/features/notifications/NotifyChip";
import { ResourcesSummary } from "@/features/resources/ResourcesSummary";
import { UsageStrip } from "@/features/usage/UsageStrip";

export function StatusBar() {
  return (
    <div class="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-bg px-2 text-faint">
      <GitChip />
      <UsageStrip />
      <div class="ml-auto flex shrink-0 items-center gap-2">
        <NotifyChip />
        <ResourcesSummary />
      </div>
    </div>
  );
}
