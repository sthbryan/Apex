import { onOpenView, sessions } from "@/features/sessions/state";
import { viewLanding } from "@/features/settings/agentMode";
import { openQuietly } from "@/features/workspace/state";

function asSplit(): boolean {
  return viewLanding.value === "split";
}

export function startViewIntents(): () => void {
  return onOpenView((event) => {
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
        window.open(target.url, "_blank");
        break;
    }
  });
}
