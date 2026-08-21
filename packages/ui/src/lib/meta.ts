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
  variants: ComponentVariant[];
}
