import { signal } from "@preact/signals";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";

import {
  attachSession,
  onSessionOutput,
  resizeSession,
  resumeTerminal,
  sendInput,
  suspendTerminal,
} from "@/features/sessions/state";
import { fontFamily, readTerminalTheme } from "@/shared/theme/xterm";

type Entry = {
  element: HTMLDivElement;
  terminal: Terminal;
  fit: FitAddon;
  teardown: () => void;
  sent?: { rows: number; cols: number };
};

const registry = new Map<string, Entry>();
const scheduled = new Map<string, number>();

export const spoken = signal<ReadonlySet<string>>(new Set());

export async function mountTerminal(id: string, host: HTMLElement): Promise<Entry> {
  const existing = registry.get(id);
  if (existing) {
    host.appendChild(existing.element);
    resize(existing, id);
    return existing;
  }
  resumeTerminal(id);

  const element = document.createElement("div");
  element.className = "h-full w-full";
  host.appendChild(element);

  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
  ]);

  const terminal = new Terminal({
    allowProposedApi: true,
    cursorBlink: true,
    fontFamily: fontFamily(),
    fontSize: 13,
    lineHeight: 1.2,
    scrollback: 2000,
    theme: readTerminalTheme(),
  });

  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(element);

  let disposed = false;
  void (async () => {
    try {
      const { WebglAddon } = await import("@xterm/addon-webgl");
      if (disposed) {
        return;
      }
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      terminal.loadAddon(webgl);
    } catch {}
  })();

  const stopOutput = onSessionOutput(id, (data) => {
    if (data.length > 0 && !spoken.value.has(id)) {
      spoken.value = new Set(spoken.value).add(id);
    }
    terminal.write(data);
  });
  const input = terminal.onData((data) => void sendInput(id, data));

  const entry: Entry = {
    element,
    terminal,
    fit,
    teardown: () => {
      disposed = true;
      stopOutput();
      input.dispose();
      terminal.dispose();
      element.remove();
    },
  };
  registry.set(id, entry);

  void attachSession(id).then(() => resize(entry, id));
  return entry;
}

export function detachTerminal(id: string, host?: HTMLElement): void {
  const entry = registry.get(id);
  if (!entry) {
    return;
  }
  if (host && !host.contains(entry.element)) {
    return;
  }
  suspendTerminal(id);
  disposeTerminal(id);
}

export function disposeTerminal(id: string): void {
  const entry = registry.get(id);
  if (!entry) {
    return;
  }
  const frame = scheduled.get(id);
  if (frame !== undefined) {
    cancelAnimationFrame(frame);
    scheduled.delete(id);
  }
  registry.delete(id);
  entry.teardown();
}

export function refitTerminal(id: string): void {
  if (scheduled.has(id)) {
    return;
  }
  scheduled.set(
    id,
    requestAnimationFrame(() => {
      scheduled.delete(id);
      const entry = registry.get(id);
      if (entry) {
        resize(entry, id);
      }
    }),
  );
}

export function revealTerminal(id: string): void {
  const entry = registry.get(id);
  if (!entry) {
    return;
  }
  entry.terminal.refresh(0, entry.terminal.rows - 1);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    for (const id of registry.keys()) {
      revealTerminal(id);
    }
  }
});

export function focusTerminal(id: string): void {
  registry.get(id)?.terminal.focus();
}

export function retheme(): void {
  const theme = readTerminalTheme();
  for (const entry of registry.values()) {
    entry.terminal.options.theme = theme;
  }
}

function resize(entry: Entry, id: string): void {
  if (entry.element.clientWidth === 0 || entry.element.clientHeight === 0) {
    return;
  }
  entry.fit.fit();

  const { rows, cols } = entry.terminal;
  if (entry.sent?.rows === rows && entry.sent.cols === cols) {
    return;
  }
  entry.sent = { rows, cols };
  void resizeSession(id, { rows, cols });
}
