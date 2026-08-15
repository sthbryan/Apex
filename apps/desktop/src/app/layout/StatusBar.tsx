import { GitChip } from "@/features/git/GitChip";
import { ResourcesSummary } from "@/features/resources/ResourcesSummary";

export function StatusBar() {
  return (
    <div class="flex h-6 shrink-0 items-center justify-between gap-3 border-t border-border bg-bg px-2 text-faint">
      <GitChip  />
      <ResourcesSummary />
    </div>
  );
}
