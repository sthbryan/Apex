import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { createPortal } from "preact/compat";
import { useContext } from "preact/hooks";

export type PaneHosts = {
  lead: HTMLElement | null;
  title: HTMLElement | null;
  sub: HTMLElement | null;
  controls: HTMLElement | null;
};

const EMPTY: PaneHosts = { lead: null, title: null, sub: null, controls: null };

export const PaneSlots = createContext<PaneHosts>(EMPTY);

function Slot({ into, children }: { into: keyof PaneHosts; children: ComponentChildren }) {
  const host = useContext(PaneSlots)[into];
  return host ? createPortal(<>{children}</>, host) : null;
}

export function PaneLead({ children }: { children: ComponentChildren }) {
  return <Slot into="lead">{children}</Slot>;
}

export function PaneTitle({ children }: { children: ComponentChildren }) {
  return <Slot into="title">{children}</Slot>;
}

export function PaneSub({ children }: { children: ComponentChildren }) {
  return <Slot into="sub">{children}</Slot>;
}

export function PaneControls({ children }: { children: ComponentChildren }) {
  return <Slot into="controls">{children}</Slot>;
}
