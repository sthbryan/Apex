import { AppBody, Rail, RailButton, SidePanel, TitleBar, Wordmark } from "@apex/ui";
import { Dock } from "@/app/layout/Dock";
import { DOCK_PANELS } from "@/app/layout/panels";
import { StatusBar } from "@/app/layout/StatusBar";
import {
  dockMode,
  dockOrder,
  dockPanel,
  setDockMode,
  setDockPanel,
  toggleDock,
} from "@/app/layout/state";
import { Toolbar, ToolbarButton } from "@/app/layout/Toolbar";
import { Views } from "@/app/Views";
import { page, toggleSettings } from "@/app/view";
import { ProjectPicker } from "@/features/projects/ProjectPicker";
import { activeProject } from "@/features/projects/state";
import { status } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const NEXT = {
  expanded: { label: "dock.toRail", icon: "panelClose" },
  rail: { label: "dock.toExpanded", icon: "panelOpen" },
} as const;

type Props = {
  onNewSession: () => void;
};

export function Layout({ onNewSession }: Props) {
  const mode = dockMode.value;
  const rail = mode === "rail";
  const order = dockOrder.value;
  const active = order.includes(dockPanel.value) ? dockPanel.value : order[0];

  return (
    <div class="relative flex h-full flex-col text-text">
      <TitleBar
        data-tauri-drag-region
        lights={false}
        style={{ paddingLeft: "max(var(--apex-controls-start, 0px), 12px)" }}
        title={
          <>
            <Wordmark size="sm">APEX</Wordmark>
            {activeProject.value ? ` · ${activeProject.value.name}` : ""}
          </>
        }
        actions={
          <Toolbar status={status.value === "ready" ? "" : t("status.connecting")}>
            <ToolbarButton
              label={t(NEXT[mode].label)}
              icon={NEXT[mode].icon}
              onClick={toggleDock}
            />
            <ToolbarButton label={t("toolbar.newSession")} icon="plus" onClick={onNewSession} />
            <ToolbarButton
              label={t("settings.title")}
              icon="settings"
              pressed={page.value === "settings"}
              onClick={() => toggleSettings()}
            />
          </Toolbar>
        }
      />

      <AppBody>
        <Rail aria-label={t("dock.panels")}>
          {order.map((id) => (
            <RailButton
              key={id}
              label={DOCK_PANELS[id].label()}
              current={!rail && active === id}
              badge={DOCK_PANELS[id].badge?.() ?? undefined}
              onClick={() => {
                setDockPanel(id);
                setDockMode("expanded");
              }}
            >
              <Icon name={DOCK_PANELS[id].icon} size={16} />
            </RailButton>
          ))}
        </Rail>

        <SidePanel flush collapsed={rail} head={<ProjectPicker />}>
          <Dock />
        </SidePanel>

        <div class="flex min-w-0 flex-1 flex-col">
          <Views />
        </div>
      </AppBody>

      <StatusBar />
    </div>
  );
}
