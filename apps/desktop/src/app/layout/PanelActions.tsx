import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import { useContext } from "preact/hooks";

import { DockChrome } from "@/app/layout/DockChrome";

type Props = {
  children: ComponentChildren;
};

export function PanelActions({ children }: Props) {
  const slot = useContext(DockChrome);

  if (slot) {
    return createPortal(children, slot);
  }

  return <div class="flex shrink-0 items-center justify-end gap-2 px-2 py-1">{children}</div>;
}
