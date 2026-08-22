import type { ComponentMeta } from "@/lib/meta";
import { ImageView } from "@/organisms/image-view/ImageView";

const SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect width='120' height='80' fill='%23f59e0b' opacity='.5'/%3E%3C/svg%3E";

export const imageViewMeta: ComponentMeta = {
  name: "ImageView",
  layer: "organism",
  description: "Image on a checkered stage, fitted or at actual size.",
  rule: "The checker pattern is what tells you the image has transparency. Never put an image on a flat pane.",
  component: ImageView,
  variants: [
    { name: "contain", props: { src: SRC, alt: "Sample", class: "h-24 w-48" } },
    { name: "with meta", props: { src: SRC, alt: "Sample", meta: "120 × 80 · PNG", class: "h-24 w-48" } },
  ],
};
