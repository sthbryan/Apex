import type { ComponentType } from "preact";

export type ComponentLayer = "atom" | "molecule" | "organism";

export interface ComponentVariant {
  name: string;
  props: Record<string, unknown>;
  children?: string;
}

export interface ComponentMeta {
  name: string;
  layer: ComponentLayer;
  description: string;
  component: ComponentType<any>;
  variants: ComponentVariant[];
}
