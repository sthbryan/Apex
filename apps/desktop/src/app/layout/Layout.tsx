import {
  AppBody,
  Button,
  Rail,
  RailButton,
  RailDivider,
  SidePanel,
  TitleBar,
  Wordmark,
} from "@apex/ui";
import { getCurrentWindow } from "@tauri-apps/api/window";
import cn from "cnfast";
import { useCallback } from "preact/hooks";
import { Aside } from "@/app/layout/Aside";
import { Dock } from "@/app/layout/Dock";
import { DockResize } from "@/app/layout/DockResize";
import { DOCK_PANELS } from "@/app/layout/panels";
import { StatusBar } from "@/app/layout/StatusBar";
import {
  type DockPanel,
  dockMode,
  dockOrder,
  dockPanel,
  dockResizing,
  setDockMode,
  setDockPanel,
  settleDockPanel,
  toggleAside,
  toggleDock,
} from "@/app/layout/state";
import { Toolbar, ToolbarButton } from "@/app/layout/Toolbar";
import { Views } from "@/app/Views";
import { page, toggleSettings } from "@/app/view";
import { toggleBrowser } from "@/features/browser/state";
import { ProjectPicker } from "@/features/projects/ProjectPicker";
import { activeProject } from "@/features/projects/state";
import { groupOn } from "@/features/settings/toolGroups";
import { homeOpen, openHome } from "@/features/workspace/state";
import { platform, status } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";
import { useReorder } from "@/shared/ui/reorder";

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

  const settle = useCallback((id: string, seat: number) => {
    settleDockPanel(id as DockPanel, seat);
  }, []);

  const { held, seat, grab } = useReorder(settle);
  const from = held ? order.indexOf(held as DockPanel) : -1;
  const undecorated = platform.value === "linux";

  return (
    <div class="relative flex h-full flex-col text-text">
      <TitleBar
        data-tauri-drag-region
        lights={undecorated}
        onClose={undecorated ? () => void getCurrentWindow().close() : undefined}
        onMinimize={undecorated ? () => void getCurrentWindow().minimize() : undefined}
        onMaximize={undecorated ? () => void getCurrentWindow().toggleMaximize() : undefined}
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
            {groupOn("browser") && (
              <ToolbarButton label={t("browser.open")} icon="globe" onClick={toggleBrowser} />
            )}
            {groupOn("api") && (
              <ToolbarButton label={t("api.open")} icon="send" onClick={() => toggleAside("api")} />
            )}
            <ToolbarButton label={t("shortcuts.palette")} icon="grid" onClick={onNewSession} />
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
        <Rail aria-label={t("dock.panels")} data-reorder>
          <RailButton label={t("home.title")} current={homeOpen.value} onClick={openHome}>
            <Icon name="home" size={16} />
          </RailButton>
          <RailDivider />
          {order.map((id, index) => {
            const mark = seat !== null && from >= 0 && seat !== from && index === seat;
            return (
              <RailButton
                key={id}
                data-seat
                label={DOCK_PANELS[id].label()}
                current={!rail && active === id}
                badge={DOCK_PANELS[id].badge?.() ?? undefined}
                class={cn(held === id && "opacity-40")}
                onMouseDown={(event) => grab(id, index, event)}
                onClick={() => {
                  setDockPanel(id);
                  setDockMode("expanded");
                }}
              >
                <Icon name={DOCK_PANELS[id].icon} size={16} />
                {mark ? (
                  <span
                    class={cn(
                      "absolute inset-x-1 h-0.5 bg-accent",
                      seat < from ? "top-0" : "bottom-0",
                    )}
                  />
                ) : null}
              </RailButton>
            );
          })}
        </Rail>

        <SidePanel
          flush
          class="apex-panel-surface"
          collapsed={rail}
          data-resizing={dockResizing.value || undefined}
          grip={<DockResize />}
          head={<ProjectPicker />}
          foot={
            <Button variant="primary" size="lg" class="w-full" onClick={openHome}>
              <Icon name="plus" size={14} />
              {t("toolbar.newSession")}
            </Button>
          }
        >
          <Dock />
        </SidePanel>

        <div class="apex-workspace-surface flex min-w-0 flex-1 flex-col">
          <Views />
        </div>

        <Aside />
      </AppBody>

      <StatusBar />
    </div>
  );
}
