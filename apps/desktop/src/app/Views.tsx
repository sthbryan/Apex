import { page } from "@/app/view";
import { Settings } from "@/features/settings/Settings";
import { Workspace } from "@/features/workspace/Workspace";

export function Views() {
  switch (page.value) {
    case "settings":
      return <Settings />;
    default:
      return <Workspace />;
  }
}
