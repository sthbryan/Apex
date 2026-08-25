import { dockPanelAt } from "@/app/layout/actions";
import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import { cycleLayout, splitWithShellAt } from "@/features/sessions/pending";
import { closePane, extractLeafToTab, swapPaneWithSibling, tabs } from "@/features/workspace/state";
import type { Leaf } from "@/features/workspace/tree";
import { siblingOf } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";
import type { MenuEntry } from "@/shared/ui/ContextMenu";

export function paneMenu(tabId: string, leaf: Leaf): MenuEntry[] {
  const currentTab = tabs.value.find((tab) => tab.id === tabId);
  const split = (currentTab?.root.kind ?? "leaf") === "split";
  const panel = leaf.view.type === "panel" && leaf.view.panel in DOCK_PANELS;
  const swapable = Boolean(currentTab && siblingOf(currentTab.root, leaf.id));
  const splittable = leaf.view.type === "session";
  const entries: MenuEntry[] = [];

  if (splittable) {
    entries.push({
      label: t("workspace.splitRight"),
      icon: "splitRight",
      run: () => void splitWithShellAt(tabId, leaf.id, "row"),
    });
    entries.push({
      label: t("workspace.splitDown"),
      icon: "splitDown",
      run: () => void splitWithShellAt(tabId, leaf.id, "column"),
    });
  }
  if (split) {
    entries.push({
      label: t("workspace.rotateLayout"),
      icon: "grid",
      hint: "⌘⇧L",
      run: cycleLayout,
    });
  }
  if (swapable) {
    entries.push({
      label: t("workspace.swapPane"),
      icon: "move",
      run: () => swapPaneWithSibling(tabId, leaf.id),
    });
  }
  if (split) {
    entries.push({
      label: t("workspace.toTab"),
      icon: "external",
      run: () => extractLeafToTab(tabId, leaf.id),
    });
  }
  if (panel && leaf.view.type === "panel") {
    const { panel: which } = leaf.view;
    entries.push({
      label: t("dock.popIn"),
      icon: "panel",
      run: () => dockPanelAt(which as DockPanel),
    });
  }
  if (entries.length > 0) {
    entries.push({ rule: true });
  }
  entries.push({
    label: t("workspace.closePane"),
    icon: "close",
    danger: true,
    run: () => closePane(tabId, leaf, true),
  });

  return entries;
}
