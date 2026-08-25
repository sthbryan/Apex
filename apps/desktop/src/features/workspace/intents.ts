import { openWeb } from "@/features/browser/state";
import { onCloseView, onOpenView, sessions } from "@/features/sessions/state";
import { viewLanding } from "@/features/settings/agentMode";
import { closeViews, openQuietly } from "@/features/workspace/state";

function asSplit(): boolean {
  return viewLanding.value === "split";
}

export function startViewIntents(): () => void {
  const stopOpening = onOpenView((event) => {
    const target = event.target;
    switch (target.kind) {
      case "session": {
        const wanted = sessions.value.find((session) => session.id === target.id);
        if (wanted) {
          openQuietly({ type: "session", sessionId: wanted.id }, asSplit());
        }
        break;
      }
      case "file":
        openQuietly({ type: "file", path: target.path }, asSplit());
        break;
      case "url":
        openWeb(target.url);
        break;
    }
  });
  const stopClosing = onCloseView((event) => {
    const target = event.target;
    switch (target.kind) {
      case "session":
        closeViews((view) => view.type === "session" && view.sessionId === target.id);
        break;
      case "file":
        closeViews((view) => view.type === "file" && view.path === target.path);
        break;
      case "url":
        closeViews(
          (view) =>
            view.type === "browser" &&
            (target.name ? view.name === target.name : view.url === target.url),
        );
        break;
    }
  });
  return () => {
    stopOpening();
    stopClosing();
  };
}
