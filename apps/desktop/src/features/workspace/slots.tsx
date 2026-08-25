import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { createPortal } from "preact/compat";
import { useContext } from "preact/hooks";

export type PaneHosts = {
  sub: HTMLElement | null;
  controls: HTMLElement | null;
};

const EMPTY: PaneHosts = { sub: null, controls: null };

export const PaneSlots = createContext<PaneHosts>(EMPTY);

function Slot({ into, children }: { into: keyof PaneHosts; children: ComponentChildren }) {
  const host = useContext(PaneSlots)[into];
  return host ? createPortal(children, host) : null;
}

export function PaneSub({ children }: { children: ComponentChildren }) {
  return <Slot into="sub">{children}</Slot>;
}

export function PaneControls({ children }: { children: ComponentChildren }) {
  return <Slot into="controls">{children}</Slot>;
}
