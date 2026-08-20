import { DOCK_PANELS } from "@/app/layout/panels";
import type { DockPanel } from "@/app/layout/state";
import type { SessionSummary } from "@/bindings/SessionSummary";
import { fileName } from "@/features/files/state";
import type { PaneView } from "@/features/workspace/tree";
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
  if (view.type === "browser") {
    return hostOf(view.url);
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
  if (view.type === "browser") {
    return "globe";
  }
  return "sessions";
}

export function paneSubtitle(view: PaneView): string | null {
  if (view.type === "file") {
    return view.path;
  }
  if (view.type === "diff") {
    return view.path || view.commit;
  }
  if (view.type === "browser") {
    return null;
  }
  return null;
}

function hostOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  } catch {
    return url;
  }
}
