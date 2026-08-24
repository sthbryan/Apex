import cn from "cnfast";
import { closePane } from "@/features/workspace/state";
import type { Leaf } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  tabId: string;
  leaf: Leaf;
  focused?: boolean;
};

export function PaneActions({ tabId, leaf, focused = false }: Props) {
  return (
    <div
      class={cn(
        "flex shrink-0 items-center gap-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
        focused ? "opacity-100" : "opacity-0",
      )}
    >
      <button
        type="button"
        title={t("workspace.closePane")}
        onClick={() => closePane(tabId, leaf, true)}
        class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}
