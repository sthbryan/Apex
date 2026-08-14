import { popPanelToTab } from "@/app/layout/actions";
import { allowPanelDrop, readPanelDrag } from "@/app/layout/dnd";
import { activeProject } from "@/features/projects/state";
import { sessions } from "@/features/sessions/state";
import { PaneTree } from "@/features/workspace/PaneTree";
import { activeTabId, tabs } from "@/features/workspace/state";
import { TabBar } from "@/features/workspace/TabBar";
import { t } from "@/shared/i18n";

export function Workspace() {
  const acceptPanel = (event: DragEvent) => {
    allowPanelDrop(event);
  };
  const dropPanel = (event: DragEvent) => {
    const id = readPanelDrag();
    if (id) {
      event.preventDefault();
      popPanelToTab(id);
    }
  };

  return (
    <>
      <TabBar tabs={tabs.value} sessions={sessions.value} />

      <div class="relative min-h-0 flex-1" onDragOver={acceptPanel} onDrop={dropPanel}>
        {tabs.value.length === 0 ? (
          <div class="flex h-full flex-col items-center justify-center gap-1 text-faint">
            <p>{activeProject.value ? t("workspace.empty") : t("projects.empty")}</p>
            {activeProject.value && <p>{t("workspace.emptyHint", { shortcut: "⌘K" })}</p>}
          </div>
        ) : (
          tabs.value.map((tab) => {
            const active = tab.id === activeTabId.value;
            return (
              <div
                key={tab.id}
                class="absolute inset-0"
                style={{ visibility: active ? "visible" : "hidden", zIndex: active ? 1 : 0 }}
              >
                <PaneTree
                  tabId={tab.id}
                  node={tab.root}
                  activeLeafId={tab.activeLeafId}
                  tabActive={active}
                />
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
