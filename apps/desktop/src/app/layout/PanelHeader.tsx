import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import { useContext } from "preact/hooks";

import { DockChrome } from "@/app/layout/DockChrome";

type Props = {
  title: string;
  children?: ComponentChildren;
};

export function PanelHeader({ title, children }: Props) {
  const slot = useContext(DockChrome);

  if (slot) {
    return children ? createPortal(children, slot) : null;
  }

  return (
    <div class="flex shrink-0 items-center gap-2 px-2 py-1">
      <h2 class="min-w-0 truncate text-micro font-medium text-text">{title}</h2>
      {children && <div class="ml-auto flex min-w-0 items-center gap-2">{children}</div>}
    </div>
  );
}
