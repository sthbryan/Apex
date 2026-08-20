import { GitChip } from "@/features/git/GitChip";
import { gitStatus } from "@/features/git/state";
import { NotifyChip } from "@/features/notifications/NotifyChip";
import { activeProject } from "@/features/projects/state";
import { ResourcesSummary } from "@/features/resources/ResourcesSummary";
import { hasUsage } from "@/features/usage/state";
import { UsageStrip } from "@/features/usage/UsageStrip";

export function StatusBar() {
  const onGit = Boolean(activeProject.value?.is_git) && gitStatus.value !== null;
  const onUsage = hasUsage.value;

  return (
    <div class="shrink-0 px-(--apex-statusbar-gap) pb-(--apex-statusbar-gap)">
      <div class="flex h-(--apex-statusbar-h) items-center gap-2.5 rounded-lg border border-border bg-float px-2 text-faint shadow-[0_4px_16px_var(--apex-dock-shadow)]">
        {onGit && <GitChip />}
        {onGit && onUsage && <Divider />}
        {onUsage && <UsageStrip />}
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <NotifyChip />
          <ResourcesSummary />
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" class="h-3 w-px shrink-0 bg-border" />;
}
