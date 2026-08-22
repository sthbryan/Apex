import type { ComponentChildren } from "preact";
import { cn } from "@/lib/cn";

export type GlyphSize = "sm" | "md" | "lg";
export type GlyphTone = "accent" | "neutral";

export interface GlyphProps {
  size?: GlyphSize;
  tone?: GlyphTone;
  class?: string;
  children?: ComponentChildren;
}

export function Glyph({ size = "md", tone = "accent", class: className, children }: GlyphProps) {
  return (
    <span class={cn("ui-glyph", className)} data-size={size} data-tone={tone} aria-hidden="true">
      {children}
    </span>
  );
}
