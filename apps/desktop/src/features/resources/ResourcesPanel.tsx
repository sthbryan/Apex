import { Popover } from "@apex/ui";
import type { ComponentChildren } from "preact";
import type { MetricsSnapshot } from "@/bindings/MetricsSnapshot";
import { ApexSection } from "@/features/resources/ApexSection";
import { SessionSection } from "@/features/resources/SessionSection";
import { SystemSection } from "@/features/resources/SystemSection";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  open: boolean;
  snapshot: MetricsSnapshot | null;
  anchor: ComponentChildren;
  onClose: () => void;
};

export function ResourcesPanel({ open, snapshot, anchor, onClose }: Props) {
  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      side="top"
      align="end"
      width={320}
      label={t("resources.title")}
      title={
        <>
          <Icon name="activity" size={12} class="text-faint" />
          {t("resources.title")}
        </>
      }
    >
      {snapshot ? (
        <>
          <ApexSection apex={snapshot.apex} system={snapshot.system} />
          <SystemSection system={snapshot.system} />
          <SessionSection sessions={snapshot.sessions} />
        </>
      ) : (
        <p class="px-1 py-1 text-faint">{t("resources.sampling")}</p>
      )}
    </Popover>
  );
}
