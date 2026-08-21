import { useEffect, useState } from "preact/hooks";

export type TokenKind = "color" | "size";
export type TokenValues = Record<string, { light: string; dark: string }>;

function createReader() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return (value: string): string => {
    if (!ctx) return value;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const hex = [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
    return a === 255 ? `#${hex}` : `#${hex}${a.toString(16).padStart(2, "0")}`;
  };
}

function probe(theme: "light" | "dark", tokens: Record<string, TokenKind>): Record<string, string> {
  const toHex = createReader();
  const el = document.createElement("div");
  el.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:0;color-scheme:${theme}`;
  document.body.append(el);
  const style = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const [name, kind] of Object.entries(tokens)) {
    if (kind === "color") {
      el.style.color = `var(${name})`;
      out[name] = toHex(style.color);
    } else {
      el.style.width = `var(${name})`;
      out[name] = style.width;
    }
  }
  el.remove();
  return out;
}

export function useTokenValues(tokens: Record<string, TokenKind>): TokenValues {
  const [values, setValues] = useState<TokenValues>({});
  const names = Object.keys(tokens);
  const key = names.join("|");

  useEffect(() => {
    const light = probe("light", tokens);
    const dark = probe("dark", tokens);
    setValues(Object.fromEntries(names.map((n) => [n, { light: light[n], dark: dark[n] }])));
  }, [key]);

  return values;
}
