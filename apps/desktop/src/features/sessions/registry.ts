import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";

import {
  attachSession,
  onSessionOutput,
  resizeSession,
  sendInput,
} from "@/features/sessions/state";
import { fontFamily, readTerminalTheme } from "@/shared/theme/xterm";

type Entry = {
  element: HTMLDivElement;
  terminal: Terminal;
  fit: FitAddon;
  teardown: () => void;
};

const registry = new Map<string, Entry>();

export function mountTerminal(id: string, host: HTMLElement): Entry {
  const existing = registry.get(id);
  if (existing) {
    host.appendChild(existing.element);
    resize(existing, id);
    return existing;
  }

  const element = document.createElement("div");
  element.className = "h-full w-full";
  host.appendChild(element);

  const terminal = new Terminal({
    allowProposedApi: true,
    cursorBlink: true,
    fontFamily: fontFamily(),
    fontSize: 13,
    lineHeight: 1.2,
    scrollback: 10000,
    theme: readTerminalTheme(),
  });

  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(element);

  try {
    terminal.loadAddon(new WebglAddon());
  } catch {}

  const stopOutput = onSessionOutput(id, (data) => terminal.write(data));
  const input = terminal.onData((data) => void sendInput(id, data));

  const entry: Entry = {
    element,
    terminal,
    fit,
    teardown: () => {
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

export function detachTerminal(id: string): void {
  registry.get(id)?.element.remove();
}

export function disposeTerminal(id: string): void {
  const entry = registry.get(id);
  if (!entry) {
    return;
  }
  registry.delete(id);
  entry.teardown();
}

export function refitTerminal(id: string): void {
  const entry = registry.get(id);
  if (entry) {
    resize(entry, id);
  }
}

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
  void resizeSession(id, { rows: entry.terminal.rows, cols: entry.terminal.cols });
}
