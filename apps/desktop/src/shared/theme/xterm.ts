import type { ITheme } from "@xterm/xterm";

let probe: HTMLSpanElement | null = null;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function color(name: string): string {
  if (!probe) {
    probe = document.createElement("span");
    probe.style.display = "none";
    document.body.appendChild(probe);
  }
  probe.style.color = `var(${name})`;
  return getComputedStyle(probe).color;
}

export function readTerminalTheme(): ITheme {
  return {
    background: color("--apex-tty"),
    foreground: color("--apex-text"),
    cursor: color("--apex-accent"),
    cursorAccent: color("--apex-bg"),
    selectionBackground: color("--apex-selection"),
    black: color("--apex-ansi-black"),
    red: color("--apex-ansi-red"),
    green: color("--apex-ansi-green"),
    yellow: color("--apex-ansi-yellow"),
    blue: color("--apex-ansi-blue"),
    magenta: color("--apex-ansi-magenta"),
    cyan: color("--apex-ansi-cyan"),
    white: color("--apex-ansi-white"),
    brightBlack: color("--apex-ansi-bright-black"),
    brightRed: color("--apex-ansi-bright-red"),
    brightGreen: color("--apex-ansi-bright-green"),
    brightYellow: color("--apex-ansi-bright-yellow"),
    brightBlue: color("--apex-ansi-bright-blue"),
    brightMagenta: color("--apex-ansi-bright-magenta"),
    brightCyan: color("--apex-ansi-bright-cyan"),
    brightWhite: color("--apex-ansi-bright-white"),
  };
}

export function fontFamily(): string {
  return token("--font-mono") || "monospace";
}

export function terminalFontSize(): number {
  const scale = Number.parseFloat(token("--apex-scale"));
  return Math.round(13 * (Number.isFinite(scale) && scale > 0 ? scale : 1));
}
