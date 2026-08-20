import { useEffect, useRef } from "preact/hooks";
import { Dock } from "@/app/layout/Dock";
import { DockSlot } from "@/app/layout/DockSlot";
import { StatusBar } from "@/app/layout/StatusBar";
import { cycleDock, dockHover, dockMode, setDockHover } from "@/app/layout/state";
import { TitleBar } from "@/app/layout/TitleBar";
import { Toolbar, ToolbarButton } from "@/app/layout/Toolbar";
import { Views } from "@/app/Views";
import { page, togglePage } from "@/app/view";
import { ProjectPicker } from "@/features/projects/ProjectPicker";
import { status } from "@/shared/daemon";
import { t } from "@/shared/i18n";

const PEEK_DELAY = 180;

const NEXT_LABEL = {
  expanded: "dock.toRail",
  rail: "dock.toHidden",
  hidden: "dock.toExpanded",
} as const;

type Props = {
  onNewSession: () => void;
};

export function Layout({ onNewSession }: Props) {
  const mode = dockMode.value;
  const rail = mode === "rail";
  const peeking = mode === "hidden" && dockHover.value;
  const dockVisible = mode !== "hidden" || peeking;
  const dwell = useRef<number | null>(null);

  const cancelPeek = () => {
    if (dwell.current !== null) {
      clearTimeout(dwell.current);
      dwell.current = null;
    }
  };

  useEffect(
    () => () => {
      if (dwell.current !== null) {
        clearTimeout(dwell.current);
      }
    },
    [],
  );

  const sidebarToggle = (
    <ToolbarButton
      label={t(NEXT_LABEL[mode])}
      icon="panel"
      pressed={mode !== "hidden"}
      onClick={cycleDock}
    />
  );

  const padStart = rail
    ? "max(calc(var(--apex-controls-start, 0px) - var(--apex-rail-width)), 12px)"
    : mode === "hidden"
      ? "max(var(--apex-controls-start, 0px), 12px)"
      : "12px";

  return (
    <div class="relative flex h-full flex-col text-text">
      <div class="flex min-h-0 flex-1">
        <DockSlot open={dockVisible} overlay={peeking} rail={rail} onHoverChange={setDockHover}>
          <Dock
            floating={peeking}
            rail={rail}
            header={
              <>
                <span data-tauri-drag-region class="h-full flex-1" />
                {peeking && <span class="pr-2">{sidebarToggle}</span>}
              </>
            }
          >
            <ProjectPicker variant="dock" />
          </Dock>
        </DockSlot>

        <div class="flex min-w-0 flex-1 flex-col">
          <TitleBar
            padStart={padStart}
            lead={
              <>
                {sidebarToggle}
                {!dockVisible && <ProjectPicker />}
              </>
            }
          >
            <Toolbar status={status.value === "ready" ? "" : t("status.connecting")}>
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

        {mode === "hidden" && !peeking && (
          <div
            class="absolute inset-y-0 left-0 z-20 w-2"
            onMouseEnter={() => {
              cancelPeek();
              dwell.current = window.setTimeout(() => setDockHover(true), PEEK_DELAY);
            }}
            onMouseLeave={cancelPeek}
          />
        )}
      </div>

      <StatusBar />
    </div>
  );
}
