import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { fileName } from "@/features/files/state";
import type { PaneView } from "@/features/workspace/tree";
import { t } from "@/shared/i18n";
import type { IconName } from "@/shared/ui/Icon";

export function paneTitle(view: PaneView, sessions: SessionSummary[]): string {
  if (view.type === "file") {
    return fileName(view.path);
  }
  if (view.type === "diff") {
    const label = view.path ? fileName(view.path) : (view.commit ?? "").slice(0, 7);
    return `± ${label}`;
  }
  if (view.type === "panel") {
    return DOCK_PANELS[view.panel as DockPanel]?.label() ?? view.panel;
  }
  if (view.type === "race") {
    return t("race.title");
  }
  return (
    sessions.find((session) => session.id === view.sessionId)?.title ?? view.sessionId.slice(0, 8)
  );
}

export function paneIcon(view: PaneView): IconName {
  if (view.type === "file") {
    return "file";
  }
  if (view.type === "diff") {
    return "branch";
  }
  if (view.type === "panel") {
    return DOCK_PANELS[view.panel as DockPanel]?.icon ?? "panel";
  }
  if (view.type === "race") {
    return "swap";
  }
  return "sessions";
}

export function paneSubtitle(view: PaneView): string | null {
  if (view.type === "file") {
    return folderOf(view.path);
  }
  if (view.type === "diff") {
    return view.path ? folderOf(view.path) : view.commit;
  }
  return null;
}

function folderOf(path: string): string | null {
  const cut = path.lastIndexOf("/");
  return cut > 0 ? path.slice(0, cut) : null;
}
