import type { ComponentChildren } from "preact";

import { dockPanelAt } from "@/app/layout/actions";
import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import { splitWithShellAt } from "@/features/sessions/pending";
import { sessions } from "@/features/sessions/state";
import { closePane, extractLeafToTab, swapPaneWithSibling, tabs } from "@/features/workspace/state";
import { paneIcon, paneSubtitle, paneTitle } from "@/features/workspace/title";
import type { Leaf } from "@/features/workspace/tree";
import { siblingOf } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

type Props = {
  tabId: string;
  leaf: Leaf;
  extra?: ComponentChildren;
};

export function PaneBar({ tabId, leaf, extra }: Props) {
  const currentTab = tabs.value.find((tab) => tab.id === tabId);
  const split = (currentTab?.root.kind ?? "leaf") === "split";
  const panel = leaf.view.type === "panel" && leaf.view.panel in DOCK_PANELS;
  const swapable = Boolean(currentTab && siblingOf(currentTab.root, leaf.id));

  return (
    <header class="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2">
      <Icon name={paneIcon(leaf.view)} size={12} class="shrink-0 text-faint" />
      <span class="min-w-0 truncate text-text">{paneTitle(leaf.view, sessions.value)}</span>
      {paneSubtitle(leaf.view) && (
        <span class="min-w-0 truncate text-faint">{paneSubtitle(leaf.view)}</span>
      )}
      <div class="ml-auto flex shrink-0 items-center gap-1">
        {extra}
        {leaf.view.type === "session" && (
          <>
            <button
              type="button"
              title={t("workspace.splitRight")}
              onClick={() => void splitWithShellAt(tabId, leaf.id, "row")}
              class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
            >
              <Icon name="splitRight" size={12} />
            </button>
            <button
              type="button"
              title={t("workspace.splitDown")}
              onClick={() => void splitWithShellAt(tabId, leaf.id, "column")}
              class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
            >
              <Icon name="splitDown" size={12} />
            </button>
          </>
        )}
        {swapable && (
          <button
            type="button"
            title={t("workspace.swapPane")}
            onClick={() => swapPaneWithSibling(tabId, leaf.id)}
            class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
          >
            <Icon name="move" size={12} />
          </button>
        )}
        {split && (
          <button
            type="button"
            title={t("workspace.toTab")}
            onClick={() => extractLeafToTab(tabId, leaf.id)}
            class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
          >
            <Icon name="external" size={12} />
          </button>
        )}
        {panel && leaf.view.type === "panel" && (
          <button
            type="button"
            title={t("dock.popIn")}
            onClick={() => {
              if (leaf.view.type === "panel") {
                dockPanelAt(leaf.view.panel as DockPanel);
              }
            }}
            class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
          >
            <Icon name="panel" size={12} />
          </button>
        )}
        <button
          type="button"
          title={t("workspace.closePane")}
          onClick={() => closePane(tabId, leaf, true)}
          class="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
        >
          <Icon name="close" size={12} />
        </button>
      </div>
    </header>
  );
}
