import { GitChip } from "@/features/git/GitChip";
import { ResourcesSummary } from "@/features/resources/ResourcesSummary";
import { UsageStrip } from "@/features/usage/UsageStrip";

export function StatusBar() {
  return (
    <div class="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-bg px-2 text-faint">
      <GitChip />
      <UsageStrip />
      <div class="ml-auto shrink-0">
        <ResourcesSummary />
      </div>
    </div>
  );
}
