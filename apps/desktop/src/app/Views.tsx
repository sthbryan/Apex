import { page } from "@/app/view";
import { Settings } from "@/features/settings/Settings";
import { Shortcuts } from "@/features/settings/Shortcuts";
import { Workspace } from "@/features/workspace/Workspace";

export function Views() {
  switch (page.value) {
    case "settings":
      return <Settings />;
    case "shortcuts":
      return <Shortcuts />;
    default:
      return <Workspace />;
  }
}
