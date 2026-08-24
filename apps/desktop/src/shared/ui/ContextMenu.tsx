import { Menu, MenuItem, MenuSeparator } from "@apex/ui";
import { signal } from "@preact/signals";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Icon, type IconName } from "@/shared/ui/Icon";

const EDGE = 8;

export type MenuEntry =
  | { rule: true }
  | {
      rule?: false;
      label: string;
      icon?: IconName;
      hint?: string;
      danger?: boolean;
      disabled?: boolean;
      run: () => void;
    };

type Opened = {
  x: number;
  y: number;
  entries: MenuEntry[];
};

const opened = signal<Opened | null>(null);

export function openMenu(event: MouseEvent, entries: MenuEntry[]): void {
  if (entries.length === 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  opened.value = { x: event.clientX, y: event.clientY, entries };
}

export function closeMenu(): void {
  opened.value = null;
}

export function editable(node: EventTarget | null): boolean {
  const element = node as HTMLElement | null;
  if (!element?.closest) {
    return false;
  }
  return Boolean(element.closest("input, textarea, [contenteditable='true']"));
}

export function ContextMenu() {
  const here = opened.value;

  useEffect(() => {
    const guard = (event: MouseEvent) => {
      if (!editable(event.target)) {
        event.preventDefault();
      }
    };
    document.addEventListener("contextmenu", guard);
    return () => document.removeEventListener("contextmenu", guard);
  }, []);

  if (!here) {
    return null;
  }
  return <Floating key={`${here.x}:${here.y}`} at={here} />;
}

function Floating({ at }: { at: Opened }) {
  const box = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ left: at.x, top: at.y });

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) {
      return;
    }
    const { width, height } = node.getBoundingClientRect();
    const left = Math.max(EDGE, Math.min(at.x, window.innerWidth - width - EDGE));
    const top = Math.max(EDGE, Math.min(at.y, window.innerHeight - height - EDGE));
    setSpot({ left, top });
  }, [at]);

  useEffect(() => {
    const away = (event: Event) => {
      if (!box.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    document.addEventListener("wheel", closeMenu, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
      document.removeEventListener("wheel", closeMenu);
    };
  }, []);

  return (
    <div ref={box} class="fixed" style={{ left: `${spot.left}px`, top: `${spot.top}px` }}>
      <Menu>
        {at.entries.map((entry, index) =>
          entry.rule ? (
            <MenuSeparator key={`rule-${index}`} />
          ) : (
            <MenuItem
              key={entry.label}
              hint={entry.hint}
              danger={entry.danger}
              disabled={entry.disabled}
              lead={entry.icon ? <Icon name={entry.icon} size={12} /> : undefined}
              onClick={() => {
                closeMenu();
                entry.run();
              }}
            >
              {entry.label}
            </MenuItem>
          ),
        )}
      </Menu>
    </div>
  );
}
