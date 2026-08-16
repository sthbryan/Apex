import { onOpenView, sessions } from "@/features/sessions/state";
import { openFile, openInNewTab } from "@/features/workspace/state";

export function startViewIntents(): () => void {
  return onOpenView((event) => {
    const target = event.target;
    switch (target.kind) {
      case "session": {
        const wanted = sessions.value.find((session) => session.id === target.id);
        if (wanted) {
          openInNewTab(wanted);
        }
        break;
      }
      case "file":
        openFile(target.path);
        break;
      case "url":
        window.open(target.url, "_blank");
        break;
    }
  });
}
