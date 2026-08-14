import type { ITheme } from "@xterm/xterm";

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function readTerminalTheme(): ITheme {
  return {
    background: token("--apex-bg"),
    foreground: token("--apex-text"),
    cursor: token("--apex-accent"),
    cursorAccent: token("--apex-bg"),
    selectionBackground: token("--apex-selection"),
    black: token("--apex-ansi-black"),
    red: token("--apex-ansi-red"),
    green: token("--apex-ansi-green"),
    yellow: token("--apex-ansi-yellow"),
    blue: token("--apex-ansi-blue"),
    magenta: token("--apex-ansi-magenta"),
    cyan: token("--apex-ansi-cyan"),
    white: token("--apex-ansi-white"),
    brightBlack: token("--apex-ansi-bright-black"),
    brightRed: token("--apex-ansi-bright-red"),
    brightGreen: token("--apex-ansi-bright-green"),
    brightYellow: token("--apex-ansi-bright-yellow"),
    brightBlue: token("--apex-ansi-bright-blue"),
    brightMagenta: token("--apex-ansi-bright-magenta"),
    brightCyan: token("--apex-ansi-bright-cyan"),
    brightWhite: token("--apex-ansi-bright-white"),
  };
}

export function fontFamily(): string {
  return token("--font-mono") || "monospace";
}
