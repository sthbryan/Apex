import { effect } from "@preact/signals";

import { type AsidePanel, asideOpen, asidePanel, closeAside } from "@/app/layout/state";
import { groupOn, type OptionalGroup } from "@/features/settings/toolGroups";

const NEEDS: Record<AsidePanel, OptionalGroup> = { browser: "browser", api: "api" };

export function startAsideGuard(): () => void {
  return effect(() => {
    if (asideOpen.value && !groupOn(NEEDS[asidePanel.value])) {
      closeAside();
    }
  });
}
