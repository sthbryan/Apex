import { StatusBar as Bar } from "@apex/ui";
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
    <Bar
      right={
        <>
          <NotifyChip />
          <ResourcesSummary />
        </>
      }
    >
      {onGit && <GitChip />}
      {onGit && onUsage && <Divider />}
      {onUsage && <UsageStrip />}
    </Bar>
  );
}

function Divider() {
  return <span aria-hidden="true" class="h-3 w-px shrink-0 bg-border" />;
}
