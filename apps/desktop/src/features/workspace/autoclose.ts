import { closeSession, onSessionExited } from "@/features/sessions/state";
import { dropSession } from "@/features/workspace/state";

export function startPaneCleanup(): () => void {
  return onSessionExited((id, code) => {
    if (code !== 0) {
      return;
    }
    dropSession(id);
    void closeSession(id);
  });
}
