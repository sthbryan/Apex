import type { GitStatus } from "@/bindings/GitStatus";
import type { GitSyncOp } from "@/bindings/GitSyncOp";
import { gitSyncing, syncRemote } from "@/features/git/state";
import { type MessageKey, t } from "@/shared/i18n";
import { Icon, type IconName } from "@/shared/ui/Icon";

const OPS: { op: GitSyncOp; icon: IconName; label: MessageKey }[] = [
  { op: "fetch", icon: "refresh", label: "git.fetch" },
  { op: "pull", icon: "pull", label: "git.pull" },
  { op: "push", icon: "push", label: "git.push" },
];

export function SyncActions({ status }: { status: GitStatus }) {
  const busy = gitSyncing.value;

  return (
    <>
      {OPS.map((entry) => (
        <button
          key={entry.op}
          type="button"
          disabled={busy !== null}
          title={
            status.upstream
              ? t(entry.label, { upstream: status.upstream })
              : t("git.noUpstream", { branch: status.branch })
          }
          onClick={() => void syncRemote(entry.op)}
          class="rounded p-1 text-faint transition-colors enabled:hover:bg-raised enabled:hover:text-text disabled:opacity-40"
        >
          <Icon
            name={entry.icon}
            size={12}
            class={busy === entry.op ? "animate-pulse" : undefined}
          />
        </button>
      ))}
    </>
  );
}
