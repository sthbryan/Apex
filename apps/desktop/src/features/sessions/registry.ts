import { invoke } from "@tauri-apps/api/core";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";

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

const webglSupported: Promise<boolean> = (async () => {
  try {
    const platform = await invoke<string>("host_platform");
    if (platform !== "macos") {
      return true;
    }
    const version = await invoke<string>("host_os_version");
    if (!version) {
      return true;
    }
    const [major, minor] = version.split(".").map(Number);
    return !(major > 26 || (major === 26 && minor >= 5));
  } catch {
    return true;
  }
})();

export function mountTerminal(id: string, host: HTMLElement): Entry {
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
  void webglSupported.then((supported) => {
    if (!supported || disposed) {
      return;
    }
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      terminal.loadAddon(webgl);
    } catch {}
  });

  const stopOutput = onSessionOutput(id, (data) => terminal.write(data));
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
