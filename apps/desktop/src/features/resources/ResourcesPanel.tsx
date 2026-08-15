import type { MetricsSnapshot } from "@/bindings/MetricsSnapshot";
import { ApexSection } from "@/features/resources/ApexSection";
import { SessionSection } from "@/features/resources/SessionSection";
import { SystemSection } from "@/features/resources/SystemSection";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  snapshot: MetricsSnapshot | null;
  onClose: () => void;
};

export function ResourcesPanel({ snapshot, onClose }: Props) {
  return (
    <div class="flex max-h-96 flex-col">
      <header class="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
        <Icon name="activity" size={12} class="text-faint" />
        <span class="truncate text-[12px] font-medium text-text">{t("resources.title")}</span>
        <button
          type="button"
          onClick={onClose}
          class="ml-auto text-faint transition-colors hover:text-text"
        >
          <Icon name="close" size={12} />
        </button>
      </header>

      {!snapshot ? (
        <p class="px-2.5 py-1.5 text-faint">{t("resources.sampling")}</p>
      ) : (
        <div class="overflow-y-auto">
          <ApexSection apex={snapshot.apex} system={snapshot.system} />
          <SystemSection system={snapshot.system} />
          <SessionSection sessions={snapshot.sessions} />
        </div>
      )}
    </div>
  );
}
