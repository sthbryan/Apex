import { Dock } from "@/app/layout/Dock";
import { DockSlot } from "@/app/layout/DockSlot";
import { StatusBar } from "@/app/layout/StatusBar";
import { dockMode, toggleDock } from "@/app/layout/state";
import { TitleBar } from "@/app/layout/TitleBar";
import { Toolbar, ToolbarButton } from "@/app/layout/Toolbar";
import { Views } from "@/app/Views";
import { page, togglePage } from "@/app/view";
import { gitStatus } from "@/features/git/state";
import { ProjectPicker } from "@/features/projects/ProjectPicker";
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

  const sidebarToggle = (
    <ToolbarButton label={t(NEXT[mode].label)} icon={NEXT[mode].icon} onClick={toggleDock} />
  );

  const padStart = rail
    ? "max(calc(var(--apex-controls-start, 0px) - var(--apex-rail-width)), 12px)"
    : "12px";

  return (
    <div class="relative flex h-full flex-col text-text">
      <div class="flex min-h-0 flex-1">
        <DockSlot rail={rail}>
          <Dock rail={rail} header={<span data-tauri-drag-region class="h-full flex-1" />}>
            <ProjectPicker variant="dock" />
          </Dock>
        </DockSlot>

        <div class="flex min-w-0 flex-1 flex-col">
          <TitleBar padStart={padStart} lead={sidebarToggle}>
            <Toolbar status={status.value === "ready" ? "" : t("status.connecting")}>
              {status.value === "ready" && gitStatus.value && (
                <span
                  title={
                    gitStatus.value.upstream
                      ? t("git.chipTracking", {
                          branch: gitStatus.value.branch,
                          upstream: gitStatus.value.upstream,
                        })
                      : t("git.chip", { branch: gitStatus.value.branch })
                  }
                  class="mr-2 flex max-w-48 items-center gap-1 truncate text-faint"
                >
                  <Icon name="branch" size={12} class="shrink-0" />
                  <span class="truncate">{gitStatus.value.branch}</span>
                </span>
              )}
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
      </div>

      <StatusBar />
    </div>
  );
}
