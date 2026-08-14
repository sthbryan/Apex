import { useRef } from "preact/hooks";
import { revealPanel } from "@/app/layout/actions";
import { Dock } from "@/app/layout/Dock";
import { DockSlot } from "@/app/layout/DockSlot";
import { StatusBar } from "@/app/layout/StatusBar";
import { dockHover, dockOpen, setDockHover, toggleDock } from "@/app/layout/state";
import { TitleBar } from "@/app/layout/TitleBar";
import { Toolbar, ToolbarButton } from "@/app/layout/Toolbar";
import { Views } from "@/app/Views";
import { page, togglePage } from "@/app/view";
import { GitChip } from "@/features/git/GitChip";
import { ProjectPicker } from "@/features/projects/ProjectPicker";
import { ResourcesSummary } from "@/features/resources/ResourcesSummary";
import { UsageChip } from "@/features/usage/UsageChip";
import { daemonVersion, status } from "@/shared/daemon";
import { t } from "@/shared/i18n";

type Props = {
  onNewSession: () => void;
};

export function Layout({ onNewSession }: Props) {
  const peeking = !dockOpen.value && dockHover.value;
  const dockVisible = dockOpen.value || peeking;
  const overlayMode = useRef(false);
  if (dockVisible) {
    overlayMode.current = peeking;
  }
  const overlay = overlayMode.current;

  const sidebarToggle = (
    <ToolbarButton
      label={t("dock.toggle")}
      icon="panel"
      pressed={dockOpen.value}
      onClick={toggleDock}
    />
  );

  return (
    <div class="relative flex h-full flex-col bg-bg text-text">
      <div class="flex min-h-0 flex-1">
        <DockSlot open={dockVisible} overlay={overlay} onHoverChange={setDockHover}>
          <Dock
            floating={overlay}
            header={
              <>
                <span data-tauri-drag-region class="truncate font-semibold tracking-wide">
                  {t("app.name")}
                </span>
                {!dockOpen.value && <span class="ml-auto pr-2">{sidebarToggle}</span>}
              </>
            }
          />
        </DockSlot>

        <div class="flex min-w-0 flex-1 flex-col">
          <TitleBar
            reserveControls={!dockVisible}
            lead={
              <>
                {sidebarToggle}
                <ProjectPicker />
              </>
            }
          >
            <Toolbar
              status={
                status.value === "ready"
                  ? `apexd ${daemonVersion.value ?? ""}`
                  : t("status.connecting")
              }
            >
              <UsageChip />
              <ToolbarButton label={t("toolbar.newSession")} icon="plus" onClick={onNewSession} />
              <ToolbarButton
                label={t("settings.title")}
                icon="settings"
                pressed={page.value === "settings"}
                onClick={() => togglePage("settings")}
              />
            </Toolbar>
          </TitleBar>

          <Views />
        </div>

        {!dockVisible && (
          <div class="absolute inset-y-0 left-0 z-20 w-2" onMouseEnter={() => setDockHover(true)} />
        )}
      </div>

      <StatusBar lead={<GitChip onOpen={() => revealPanel("git")} />}>
        <ResourcesSummary />
      </StatusBar>
    </div>
  );
}
