import type { ComponentChildren } from "preact";

import { popPanelToTab } from "@/app/layout/actions";
import type { DockPanel } from "@/app/layout/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  panel: DockPanel;
  children?: ComponentChildren;
};

export function PanelActions({ panel, children }: Props) {
  return (
    <>
      {children}
      <button
        type="button"
        title={t("dock.popOut")}
        onClick={() => popPanelToTab(panel)}
        class="shrink-0 text-faint transition-colors hover:text-text"
      >
        <Icon name="external" size={12} />
      </button>
    </>
  );
}
